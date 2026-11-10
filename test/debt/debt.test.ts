import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { TestContext } from '@salesforce/core/testSetup';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import { expect } from 'chai';

import TdcAdd, { type TdcAddResult } from '../../src/commands/tdc/add.js';
import TdcCheck from '../../src/commands/tdc/check.js';
import TdcGuide from '../../src/commands/tdc/guide.js';
import TdcNext from '../../src/commands/tdc/next.js';
import TdcReject from '../../src/commands/tdc/reject.js';
import TdcScan from '../../src/commands/tdc/scan.js';
import { declaredId, locate, severityOf, type DebtInput } from '../../src/debt/declared.js';
import { parseVerdict, promptRunner, VERIFIER_COMMAND_ENV } from '../../src/debt/verifier.js';
import {
  commitAll,
  createProject,
  gitInit,
  removeProject,
  SFDX_PROJECT,
  useFakeAnalyzer,
  writeSources,
} from '../helpers.js';

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
  const verifierCommand = process.env[VERIFIER_COMMAND_ENV];
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
    delete process.env[VERIFIER_COMMAND_ENV];
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
    if (verifierCommand !== undefined) process.env[VERIFIER_COMMAND_ENV] = verifierCommand;
    $$.restore();
    await removeProject(root);
  });

  it('next lists the debt most expensive first, with the command that verifies it', async () => {
    const next = await TdcNext.run(['--limit', '1']);
    expect(next.total).to.equal(2);
    expect(next.remaining).to.equal(1);
    expect(next.items[0]).to.deep.include({ rule: 'pmd:OperationWithLimitsInLoop', cost: 15, file: CLASS, line: 3 });
    expect(next.items[0].verify).to.equal(`sf tdc check --id ${next.items[0].id}`);
    expect((await TdcNext.run(['--rule', 'debug'])).items.map((item) => item.rule)).to.deep.equal([
      'pmd:AvoidDebugStatements',
    ]);
  });

  it('check --id passes when the debt is paid, and fails when it is not or the debt grew', async () => {
    const [loop, debug] = (await TdcNext.run([])).items;
    await writeSources(root, { 'classes/AccountService.cls': SOURCE.replace('{ update a; }', '{}') });
    await TdcScan.run([]);
    const paid = await TdcCheck.run(['--id', loop.id.slice(0, 6)]);
    expect(paid.passed).to.equal(true);
    expect(paid.results).to.deep.equal([{ id: loop.id, source: 'code-analyzer', file: CLASS, status: 'paid' }]);

    const present = await TdcCheck.run(['--id', debug.id]);
    expect(present.passed).to.equal(false);
    expect(present.results[0].status).to.equal('present');

    // 15 TDC paid in the loop, 20 created by four debug statements
    await writeSources(root, {
      'classes/Logger.cls': Array.from({ length: 4 }, (_, index) => `System.debug('${index}');`).join('\n'),
    });
    await TdcScan.run([]);
    process.exitCode = undefined;
    const created = await TdcCheck.run([]);
    expect(created.passed).to.equal(false);
    expect(created.sinceBase).to.deep.include({ paid: 15, created: 20 });
    expect(created.created).to.have.length(4);
    expect(created.nextSteps[0]).to.match(/^Fix /);
    expect(process.exitCode).to.equal(1);
  });

  it('check refuses debt hidden by a suppression or a change of configuration', async () => {
    const [debug] = (await TdcNext.run(['--rule', 'debug'])).items;
    await writeSources(root, {
      'classes/AccountService.cls': SOURCE.replace("System.debug('done');", "// NOPMD\n    Logger.log('done');"),
    });
    await TdcScan.run([]);
    const suppressed = await TdcCheck.run(['--id', debug.id]);
    expect(suppressed.results[0].status).to.equal('suppressed');
    expect(suppressed.cheats).to.deep.include({
      code: 'SUPPRESSION_ADDED',
      file: CLASS,
      line: 4,
      fix: 'Remove the suppression and fix the violation',
    });

    await writeSources(root, { 'classes/AccountService.cls': SOURCE });
    await writeFile(path.join(root, '.forceignore'), '**/AccountService.cls\n');
    await TdcScan.run([]);
    const ignored = await TdcCheck.run([]);
    expect(ignored.passed).to.equal(false);
    expect(ignored.cheats.map((cheat) => [cheat.code, cheat.file])).to.deep.equal([['CONFIG_CHANGED', '.forceignore']]);
    expect(ignored.results.map((item) => item.status)).to.deep.equal(['suppressed', 'suppressed']);
  });

  it('check credits a fix alongside changes to pricing, the goal, and the Salesforce API version', async () => {
    await writeFile(
      path.join(root, '.tdc/config.json'),
      JSON.stringify({ dailyRate: 800, goal: { date: '2027-03-31', debt: 15 } })
    );
    await writeFile(path.join(root, 'sfdx-project.json'), SFDX_PROJECT.replace('62.0', '63.0'));
    await writeSources(root, { 'classes/AccountService.cls': SOURCE.replace("System.debug('done');", '') });
    await TdcScan.run([]);
    const result = await TdcCheck.run([]);
    expect(result.passed).to.equal(true);
    expect(result.cheats).to.deep.equal([]);
    expect(result.sinceBase?.paid).to.equal(5);
  });

  it('check flags source scope changes from either project configuration', async () => {
    await mkdir(path.join(root, 'other'));
    await writeFile(path.join(root, '.tdc/config.json'), JSON.stringify({ sourceDirs: ['other'] }));
    await TdcScan.run([]);
    expect((await TdcCheck.run([])).cheats.map(({ file }) => file)).to.deep.equal(['.tdc/config.json']);

    await unlink(path.join(root, '.tdc/config.json'));
    await writeFile(path.join(root, 'sfdx-project.json'), SFDX_PROJECT.replace('force-app', 'other'));
    const result = await TdcCheck.run([]);
    expect(result.passed).to.equal(false);
    expect(result.cheats.map(({ file }) => file)).to.deep.equal(['sfdx-project.json']);
  });

  it('check counts new suppression markers only in scanned files', async () => {
    const oldMarker = '// NOPMD existing';
    await writeSources(root, { 'classes/AccountService.cls': `${oldMarker}\n${SOURCE}` });
    await writeFile(path.join(root, '.forceignore'), '**/Ignored.cls\n');
    await writeFile(path.join(root, 'README.md'), 'Project docs');
    commitAll(root, 'Alice', 'chore: document the project');

    await writeFile(path.join(root, 'README.md'), 'Document // NOPMD');
    await writeSources(root, {
      'classes/AccountService.cls': `${SOURCE}\n${oldMarker} explanation`,
      'classes/Ignored.cls': '// NOPMD',
    });
    const moved = await TdcCheck.run([]);
    expect(moved.passed).to.equal(true);
    expect(moved.cheats).to.deep.equal([]);

    const accented = 'force-app/main/default/classes/Résumé.cls';
    await writeSources(root, { 'classes/Résumé.cls': '// NOPMD' });
    const added = await TdcCheck.run([]);
    expect(added.passed).to.equal(false);
    expect(added.cheats.map(({ code, file, line }) => [code, file, line])).to.deep.equal([
      ['SUPPRESSION_ADDED', accented, 1],
    ]);
  });

  it('check classifies debt in a deleted file with an accented name as deleted', async () => {
    const file = 'force-app/main/default/classes/Résumé.cls';
    await writeSources(root, { 'classes/Résumé.cls': "System.debug('example');" });
    await TdcScan.run([]);
    commitAll(root, 'Alice', 'feat: add another class');
    await unlink(path.join(root, file));
    await TdcScan.run([]);

    const result = await TdcCheck.run([]);
    expect(result.sinceBase).to.deep.include({ paid: 0, deleted: 5 });
    expect(result.results[0]).to.deep.include({ file, status: 'deleted' });
  });

  it('add declares a debt whose verifier finds it, and check marks it fixed', async () => {
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
    await TdcScan.run([]);
    const fixed = await TdcCheck.run([]);
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

    await writeFile(path.join(root, '.tdc/config.json'), JSON.stringify({ verifier: { runs: 2 } }));
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

  it('check ignores a verifier command introduced by the changes, even when a prompt debt is touched', async () => {
    promptRunner.run = async () => '{"verdict":"present","evidence":"return \'005000000000001\';"}';
    const { debt } = await addFromFile({
      ...HARDCODED_ID,
      verifier: { kind: 'prompt', prompt: 'Is a user id hardcoded?' },
    });
    promptRunner.run = realRunner;
    commitAll(root, 'Alice', 'chore: declare the hardcoded id');

    await writeFile(
      path.join(root, '.tdc/config.json'),
      JSON.stringify({ verifier: { command: 'echo invoked > verifier-ran.txt', runs: 1 } })
    );
    await writeSources(root, {
      'classes/AccountService.cls': SOURCE.replace("'005000000000001'", 'UserInfo.getUserId()'),
    });
    const result = await TdcCheck.run([]);
    expect(result.passed).to.equal(true);
    expect(result.warnings[0]).to.include(VERIFIER_COMMAND_ENV);
    expect(result.results).to.deep.equal([]);
    expect(await refusal(TdcCheck.run(['--id', debt.id]))).to.equal('NO_VERIFIER_COMMAND');
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
