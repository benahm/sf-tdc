import { rename } from 'node:fs/promises';
import path from 'node:path';

import { expect } from 'chai';

import { buildLeaderboard, rankOf } from '../../src/game/leaderboard.js';
import { forecast } from '../../src/game/score.js';
import { readHistory } from '../../src/ledger/history.js';
import { writeLedger } from '../../src/ledger/ledger.js';
import { loadProject, writeConfig, DEFAULT_CONFIG } from '../../src/project/project.js';
import { scan, toLedger } from '../../src/scan/engine.js';
import {
  commitAll,
  createProject,
  fakeEngines,
  gitInit,
  removeProject,
  useFakeAnalyzer,
  writeSources,
} from '../helpers.js';

const LOOP = `public class AccountService {
  public void run(List<Id> ids) {
    for (Id id : ids) { Account a = [SELECT Id FROM Account WHERE Id = :id]; }
    for (Id id : ids) { update new Account(Id = id); }
  }
}`;

const FIXED = `public class AccountService {
  public void run(List<Id> ids) {
    List<Account> accounts = [SELECT Id FROM Account WHERE Id IN :ids];
    update accounts;
  }
}`;

const TEST = `@IsTest private class AccountServiceTest {
  @IsTest static void run() { new AccountService().run(new List<Id>()); Assert.isTrue(true); }
}`;

describe('history and leaderboard', () => {
  useFakeAnalyzer();
  let root: string;

  const scanAndCommit = async (author: string, message: string, date: string): Promise<void> => {
    const project = await loadProject(root);
    await writeLedger(project.ledgerFile, toLedger(await scan(project)));
    commitAll(root, author, message, date);
  };

  beforeEach(async () => {
    root = await createProject({
      'classes/AccountService.cls': LOOP,
      'classes/AccountServiceTest.cls': TEST,
    });
    gitInit(root);
    await scanAndCommit('Alice', 'chore: first ledger', '2026-10-01T10:00:00Z');
  });
  afterEach(() => removeProject(root));

  it('credits the author who paid the debt, and charges the one who created some', async () => {
    await writeSources(root, { 'classes/AccountService.cls': FIXED });
    await scanAndCommit('Bob', 'fix: bulkify AccountService', '2026-10-02T10:00:00Z');
    await writeSources(root, {
      'classes/Logger.cls': "public class Logger { void log() { System.debug('x'); } }",
    });
    await scanAndCommit('Carol', 'feat: add a logger', '2026-10-03T10:00:00Z');

    const events = await readHistory(await loadProject(root));
    expect(events.map((event) => [event.author, event.kind, event.coins])).to.deep.equal([
      ['Alice', 'baseline', 0],
      ['Bob', 'scored', 30],
      ['Carol', 'scored', -5],
    ]);

    const players = buildLeaderboard(events);
    expect(players.map((player) => [player.author, player.coins])).to.deep.equal([
      ['Bob', 30],
      ['Carol', -5],
    ]);
    expect(players[0].badges.map((badge) => badge.id)).to.deep.equal(['first-payment']);
    expect(players[0].payments.map((payment) => payment.rule)).to.deep.equal([
      'pmd:OperationWithLimitsInLoop',
      'pmd:OperationWithLimitsInLoop',
    ]);
  });

  it('gives no coins for a rename, nor when the rules change', async () => {
    await rename(
      path.join(root, 'force-app/main/default/classes/AccountService.cls'),
      path.join(root, 'force-app/main/default/classes/AccountSvc.cls')
    );
    await scanAndCommit('Bob', 'refactor: rename', '2026-10-02T10:00:00Z');

    await writeConfig((await loadProject(root)).configFile, {
      ...DEFAULT_CONFIG,
      rules: { 'pmd:OperationWithLimitsInLoop': { cost: 45 } },
    });
    await scanAndCommit('Carol', 'chore: reprice queries in loops', '2026-10-03T10:00:00Z');

    const events = await readHistory(await loadProject(root));
    expect(events.map((event) => [event.author, event.kind, event.coins])).to.deep.equal([
      ['Alice', 'baseline', 0],
      ['Bob', 'scored', 0],
      ['Carol', 'rules-changed', 0],
    ]);
    expect(events[1].moved).to.equal(2);
  });

  it('gives no coins when code-analyzer is upgraded', async () => {
    const version = fakeEngines.pmd;
    fakeEngines.pmd = '2.0.0';
    try {
      await writeSources(root, { 'classes/AccountService.cls': FIXED });
      await scanAndCommit('Bob', 'chore: upgrade sf-tdc', '2026-10-02T10:00:00Z');
    } finally {
      fakeEngines.pmd = version;
    }
    const events = await readHistory(await loadProject(root));
    expect(events.map((event) => [event.author, event.kind, event.coins])).to.deep.equal([
      ['Alice', 'baseline', 0],
      ['Bob', 'rules-changed', 0],
    ]);
  });

  it('forecasts the payoff date from the pace of the history', async () => {
    await writeSources(root, { 'classes/AccountService.cls': FIXED });
    await scanAndCommit('Bob', 'fix: bulkify AccountService', '2026-10-02T10:00:00Z');
    const events = await readHistory(await loadProject(root));
    const prediction = forecast(events, { debt: 0, date: '2026-12-31' }, Date.parse('2026-10-02T10:00:00Z'));
    expect(prediction?.paidPerDay).to.equal(30);
    expect(prediction?.goal?.progress).to.equal(1);
  });

  it('ranks the players by coins', () => {
    expect(rankOf(-10).rank).to.equal('Intern');
    expect(rankOf(250).nextRank).to.deep.equal({
      name: 'Collector',
      coinsToGo: 250,
      progress: 0.5,
    });
    expect(rankOf(20_000)).to.deep.equal({ rank: 'Legendary Collector' });
  });
});
