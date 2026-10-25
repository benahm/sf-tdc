import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { TestContext } from '@salesforce/core/testSetup';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import { expect } from 'chai';

import TdcAdd, { type TdcAddResult } from '../../src/commands/tdc/add.js';
import TdcGuide from '../../src/commands/tdc/guide.js';
import TdcNext from '../../src/commands/tdc/next.js';
import TdcReject from '../../src/commands/tdc/reject.js';
import TdcScan from '../../src/commands/tdc/scan.js';
import TdcVerify from '../../src/commands/tdc/verify.js';
import { declaredId, locate, severityOf, type DebtInput } from '../../src/debt/declared.js';
import { parseVerdict, promptRunner } from '../../src/debt/verifier.js';
import { commitAll, createProject, gitInit, removeProject, useFakeAnalyzer, writeSources } from '../helpers.js';

const CLASS = 'force-app/main/default/classes/AccountService.cls';
const SOURCE = `public class AccountService {
  public void run(List<Account> accounts) {
    for (Account a : accounts) { update a; }
    System.debug('done');
  }
  public Id owner() { return '005000000000001'; }
}`;

const HARDCODED_ID: DebtInput = {
  title: 'Hardcoded user id',
  description: 'The owner is a user id of one org: it breaks in every other org.',
  category: 'BestPractices',
  criticality: { exposure: 'user', impact: 'data-corruption', scope: 'bulk' },
  anchors: [{ file: CLASS, snippet: "return '005000000000001';" }],
  verifier: { kind: 'pattern', file: CLASS, pattern: "'005\\w{12}'" },
};

describe('declared debt', () => {
  it('computes the severity from the criticality', () => {
    expect(severityOf({ exposure: 'user', impact: 'data-leak', scope: 'record' })).to.equal('High');
    expect(severityOf({ exposure: 'anonymous', impact: 'data-leak', scope: 'bulk' })).to.equal('Critical');
    expect(severityOf({ exposure: 'admin', impact: 'maintainability', scope: 'record' })).to.equal('Info');
    expect(severityOf({ exposure: 'user', impact: 'limits', scope: 'bulk' })).to.equal('High');
  });

  it('identifies a debt by its category and anchors, not by its wording', () => {
    const reworded = {
      ...HARDCODED_ID,
      title: 'Another title',
      anchors: [{ file: CLASS, snippet: "return   '005000000000001';" }],
    };
    expect(declaredId(reworded)).to.equal(declaredId(HARDCODED_ID));
    expect(declaredId({ ...HARDCODED_ID, category: 'Security' })).not.to.equal(declaredId(HARDCODED_ID));
  });

  it('locates a snippet that spans lines, whatever its spaces', () => {
    expect(locate(SOURCE, "System.debug('done');\n  }  public Id")).to.equal(4);
    expect(locate(SOURCE, 'not there')).to.equal(undefined);
  });

  it('reads the verdict of an agent, even inside a JSON envelope', () => {
    expect(parseVerdict('Sure.\n{"verdict": "fixed"}')).to.deep.equal({ verdict: 'fixed' });
    expect(parseVerdict(JSON.stringify({ result: 'ok {"verdict":"present","evidence":"x"}' }))).to.deep.equal({
      verdict: 'present',
      evidence: 'x',
    });
    expect(parseVerdict('no idea').verdict).to.equal('unclear');
  });
});

describe('agent commands', () => {
  useFakeAnalyzer();
  const $$ = new TestContext();
  const initialCwd = process.cwd();
  const realRunner = promptRunner.run;
  let root: string;

  const addFromFile = async (input: unknown): Promise<TdcAddResult> => {
    await writeFile(path.join(root, 'debt.json'), JSON.stringify(input));
    return TdcAdd.run(['--file', 'debt.json']);
  };
  const refusal = async (run: Promise<unknown>): Promise<string> => {
    try {
      await run;
    } catch (error) {
      return (error as Error).name;
    }
    return expect.fail('the command should have refused');
  };

  beforeEach(async () => {
    stubSfCommandUx($$.SANDBOX);
    root = await createProject({ 'classes/AccountService.cls': SOURCE });
    gitInit(root);
    process.chdir(root);
    await TdcScan.run([]);
    commitAll(root, 'Alice', 'chore: first ledger');
  });

  afterEach(async () => {
    process.chdir(initialCwd);
    process.exitCode = undefined;
    promptRunner.run = realRunner;
    $$.restore();
    await removeProject(root);
  });

  it('next lists the debt most expensive first, with the command that verifies it', async () => {
    const next = await TdcNext.run(['--limit', '1']);
    expect(next.total).to.equal(2);
    expect(next.remaining).to.equal(1);
    expect(next.items[0]).to.deep.include({ rule: 'pmd:OperationWithLimitsInLoop', cost: 15, file: CLASS, line: 3 });
    expect(next.items[0].verify).to.equal(`sf tdc verify --id ${next.items[0].id}`);
    expect((await TdcNext.run(['--rule', 'debug'])).items.map((item) => item.rule)).to.deep.equal([
      'pmd:AvoidDebugStatements',
    ]);
  });

  it('verify passes when the debt is paid, and fails when debt is created', async () => {
    const [loop] = (await TdcNext.run(['--rule', 'Loop'])).items;
    await writeSources(root, { 'classes/AccountService.cls': SOURCE.replace('{ update a; }', '{}') });
    const paid = await TdcVerify.run(['--id', loop.id.slice(0, 6)]);
    expect(paid.passed).to.equal(true);
    expect(paid.results).to.deep.equal([{ id: loop.id, source: 'code-analyzer', file: CLASS, status: 'paid' }]);

    await writeSources(root, {
      'classes/AccountService.cls': SOURCE.replace('{ update a; }', "{ System.debug('a'); }"),
    });
    const created = await TdcVerify.run([]);
    expect(created.passed).to.equal(false);
    expect(created.created.map((item) => item.rule)).to.deep.equal(['pmd:AvoidDebugStatements']);
    expect(process.exitCode).to.equal(1);
  });

  it('verify refuses debt hidden by a suppression or a change of configuration', async () => {
    const [debug] = (await TdcNext.run(['--rule', 'debug'])).items;
    await writeSources(root, {
      'classes/AccountService.cls': SOURCE.replace("System.debug('done');", "// NOPMD\n    Logger.log('done');"),
    });
    const suppressed = await TdcVerify.run(['--id', debug.id]);
    expect(suppressed.results[0].status).to.equal('suppressed');
    expect(suppressed.cheats).to.deep.include({
      code: 'SUPPRESSION_ADDED',
      file: CLASS,
      line: 4,
      fix: 'Remove the suppression and fix the violation',
    });

    await writeSources(root, { 'classes/AccountService.cls': SOURCE });
    await writeFile(path.join(root, '.forceignore'), '**/AccountService.cls\n');
    const ignored = await TdcVerify.run([]);
    expect(ignored.passed).to.equal(false);
    expect(ignored.cheats.map((cheat) => [cheat.code, cheat.file])).to.deep.equal([['CONFIG_CHANGED', '.forceignore']]);
  });

  it('add declares a debt whose verifier finds it, and verify marks it fixed', async () => {
    const added = await addFromFile(HARDCODED_ID);
    expect(added.debt).to.deep.include({ status: 'confirmed', severity: 'Critical', cost: 60, source: 'agent' });
    expect(added.file).to.equal(`.tdc/debts/${added.debt.id}.json`);
    expect((await TdcNext.run(['--source', 'agent'])).items[0]).to.deep.include({
      id: added.debt.id,
      rule: 'declared:BestPractices',
      line: 6,
    });
    expect(await refusal(addFromFile(HARDCODED_ID))).to.equal('DUPLICATE');
    commitAll(root, 'Alice', 'chore: declare the hardcoded id');

    await writeSources(root, {
      'classes/AccountService.cls': SOURCE.replace("'005000000000001'", 'UserInfo.getUserId()'),
    });
    const fixed = await TdcVerify.run([]);
    expect(fixed.results).to.deep.include({
      id: added.debt.id,
      source: 'agent',
      file: CLASS,
      status: 'paid',
      verdicts: [{ verdict: 'fixed' }],
    });
    const stored = JSON.parse(await readFile(path.join(root, added.file), 'utf8')) as { status: string };
    expect(stored.status).to.equal('fixed');
  });

  it('add refuses a debt that is not anchored, or that its verifier does not find', async () => {
    expect(await refusal(addFromFile({ ...HARDCODED_ID, category: 'Other' }))).to.equal('INVALID_FIELD');
    expect(await refusal(addFromFile({ ...HARDCODED_ID, anchors: [{ file: CLASS, snippet: 'not there' }] }))).to.equal(
      'ANCHOR_NOT_FOUND'
    );
    expect(
      await refusal(addFromFile({ ...HARDCODED_ID, verifier: { kind: 'pattern', file: CLASS, pattern: 'nothing' } }))
    ).to.equal('CALIBRATION_FAILED');
  });

  it('a prompt verifier must find the debt every time, with evidence from the files', async () => {
    const prompt: DebtInput = { ...HARDCODED_ID, verifier: { kind: 'prompt', prompt: 'Is a user id hardcoded?' } };
    expect(await refusal(addFromFile(prompt))).to.equal('NO_VERIFIER_COMMAND');

    await writeFile(path.join(root, '.tdc/config.json'), JSON.stringify({ verifier: { command: 'agent', runs: 2 } }));
    const answers = [
      '{"verdict":"present","evidence":"return \'005000000000001\';"}',
      '{"verdict":"present","evidence":"made up"}',
    ];
    promptRunner.run = async () => answers.shift() ?? '';
    expect(await refusal(addFromFile(prompt))).to.equal('CALIBRATION_FAILED');

    promptRunner.run = async () => '{"verdict":"present","evidence":"return \'005000000000001\';"}';
    const added = await addFromFile(prompt);
    expect(added.debt.calibration).to.have.length(2);
  });

  it('reject sets a declared debt aside, but not the debt of the rules', async () => {
    const added = await addFromFile(HARDCODED_ID);
    const rejected = await TdcReject.run(['--id', added.debt.id, '--reason', 'A test org only']);
    expect(rejected.debt).to.deep.include({ status: 'rejected', reason: 'A test org only' });
    expect((await TdcNext.run(['--source', 'agent'])).items).to.deep.equal([]);

    const [loop] = (await TdcNext.run([])).items;
    expect(await refusal(TdcReject.run(['--id', loop.id, '--reason', 'no']))).to.equal('UNKNOWN_ID');
  });

  it('guide gives the workflows and the format of a declared debt', async () => {
    const guide = await TdcGuide.run([]);
    expect(guide.workflows.fix[0]).to.include('sf tdc next');
    expect(guide.declare.costs.Critical).to.equal(60);
  });
});
