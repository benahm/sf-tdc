import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { TestContext } from '@salesforce/core/testSetup';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import { expect } from 'chai';

import TdcCheck from '../../../src/commands/tdc/check.js';
import TdcInit from '../../../src/commands/tdc/init.js';
import TdcLeaderboard from '../../../src/commands/tdc/leaderboard.js';
import TdcScan from '../../../src/commands/tdc/scan.js';
import { commitAll, createProject, gitInit, removeProject, useFakeAnalyzer, writeSources } from '../../helpers.js';

const LOOP = `public class AccountService {
  public void run(List<Account> accounts) {
    for (Account a : accounts) { update a; }
  }
}`;

describe('tdc commands', () => {
  useFakeAnalyzer();
  const $$ = new TestContext();
  const initialCwd = process.cwd();
  let root: string;

  beforeEach(async () => {
    stubSfCommandUx($$.SANDBOX);
    root = await createProject({ 'classes/AccountService.cls': LOOP });
    gitInit(root);
    process.chdir(root);
  });

  afterEach(async () => {
    process.chdir(initialCwd);
    process.exitCode = undefined;
    $$.restore();
    await removeProject(root);
  });

  it('init writes the configuration, and refuses to overwrite it without --force', async () => {
    const result = await TdcInit.run(['--daily-rate', '800', '--goal-debt', '100', '--goal-date', '2027-03-31']);
    expect(result.config).to.deep.include({
      dailyRate: 800,
      goal: { debt: 100, date: '2027-03-31' },
    });
    expect(existsSync(path.join(root, '.tdc/config.json'))).to.equal(true);
    try {
      await TdcInit.run([]);
      expect.fail('init should refuse to overwrite the configuration');
    } catch (error) {
      expect((error as Error).message).to.include('already exists');
    }
  });

  it('scan prices the debt, writes the ledger, and reports what was paid since', async () => {
    const first = await TdcScan.run([]);
    // a DML in a loop, of moderate severity
    expect(first.debt).to.equal(15);
    expect(first.ledgerWritten).to.equal(true);
    expect(first.price.manDays).to.be.closeTo(15 / 60 / 7, 0.001);

    await writeSources(root, { 'classes/AccountService.cls': LOOP.replace('{ update a; }', '{}') });
    const second = await TdcScan.run(['--report-file', 'report.md']);
    expect(second.sinceLedger).to.deep.include({ paid: 15, created: 0 });
    expect(await readFile(path.join(root, 'report.md'), 'utf8')).to.include('# Technical debt');
  });

  it('scan --dry-run leaves the ledger alone', async () => {
    const result = await TdcScan.run(['--dry-run']);
    expect(result.ledgerWritten).to.equal(false);
    expect(existsSync(path.join(root, '.tdc/ledger.json'))).to.equal(false);
  });

  it('check fails on a missing or stale ledger, and on debt growing since --base', async () => {
    expect((await TdcCheck.run([])).failures).to.have.length(1);
    expect(process.exitCode).to.equal(1);

    await TdcScan.run([]);
    commitAll(root, 'Alice', 'chore: first ledger');
    process.exitCode = undefined;
    expect((await TdcCheck.run(['--base', 'HEAD'])).passed).to.equal(true);

    await writeSources(root, {
      'classes/Logger.cls': "public class Logger { void log() { System.debug('x'); } }",
    });
    const stale = await TdcCheck.run([]);
    expect(stale.ledgerUpToDate).to.equal(false);

    await TdcScan.run([]);
    const grew = await TdcCheck.run(['--base', 'HEAD', '--max-debt', '10']);
    expect(grew.sinceBase).to.deep.equal({ base: 'HEAD', paid: 0, created: 5 });
    expect(grew.failures).to.have.length(2);
  });

  it('leaderboard ranks the authors, shows a card, and hides the names with --team', async () => {
    await TdcScan.run([]);
    commitAll(root, 'Alice', 'chore: first ledger', '2026-10-01T10:00:00Z');
    await writeSources(root, { 'classes/AccountService.cls': LOOP.replace('{ update a; }', '{}') });
    await TdcScan.run([]);
    commitAll(root, 'Bob', 'fix: no DML in loop', '2026-10-02T10:00:00Z');

    const board = await TdcLeaderboard.run([]);
    expect(board.players.map((player) => [player.author, player.coins])).to.deep.equal([['Bob', 15]]);
    expect((await TdcLeaderboard.run(['--author', 'bob@example.com'])).player?.rank).to.equal('Intern');
    const team = await TdcLeaderboard.run(['--team']);
    expect(team.players).to.deep.equal([]);
    expect(team.team.coins).to.equal(15);
  });

  it('scan keeps the ledger byte for byte when nothing changed', async () => {
    await TdcScan.run([]);
    const ledger = path.join(root, '.tdc/ledger.json');
    const before = await readFile(ledger, 'utf8');
    await writeFile(path.join(root, 'README.md'), 'not scanned');
    expect((await TdcScan.run([])).ledgerWritten).to.equal(false);
    expect(await readFile(ledger, 'utf8')).to.equal(before);
  });
});
