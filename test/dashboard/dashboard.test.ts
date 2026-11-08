import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Script } from 'node:vm';

import { TestContext } from '@salesforce/core/testSetup';
import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
import { expect } from 'chai';

import TdcDashboard from '../../src/commands/tdc/dashboard.js';
import TdcScan from '../../src/commands/tdc/scan.js';
import { browser } from '../../src/dashboard/browser.js';
import { dashboardData } from '../../src/dashboard/data.js';
import { renderDashboard } from '../../src/dashboard/render.js';
import { loadProject } from '../../src/project/project.js';
import { analyzer } from '../../src/scan/engine.js';
import { commitAll, createProject, gitInit, removeProject, useFakeAnalyzer, writeSources } from '../helpers.js';

const SOURCE = "public class AccountService { void run() { System.debug('test'); } }";

describe('dashboard', () => {
  useFakeAnalyzer();
  const $$ = new TestContext();
  const cwd = process.cwd();
  let root: string;

  beforeEach(async () => {
    stubSfCommandUx($$.SANDBOX);
    root = await createProject({ 'classes/AccountService.cls': SOURCE });
    gitInit(root);
    process.chdir(root);
    await TdcScan.run([]);
  });
  afterEach(async () => {
    process.chdir(cwd);
    $$.restore();
    await removeProject(root);
  });

  it('exports offline HTML without scanning, opening a browser, or changing the ledger', async () => {
    const ledger = path.join(root, '.tdc/ledger.json');
    const before = await readFile(ledger, 'utf8');
    const run = $$.SANDBOX.stub(analyzer, 'run').rejects(new Error('must not scan'));
    const open = $$.SANDBOX.stub(browser, 'open').resolves();
    const result = await TdcDashboard.run(['--output', 'reports/debt.html']);
    expect(result).to.include({ opened: false, debt: 5, file: path.join(root, 'reports/debt.html') });
    expect(run.called).to.equal(false);
    expect(open.called).to.equal(false);
    expect(await readFile(ledger, 'utf8')).to.equal(before);
    const html = await readFile(result.file, 'utf8');
    expect(html).to.include('The repayment trajectory').and.include('Content-Security-Policy');
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    expect(scripts).to.have.length(1);
    expect(() => new Script(scripts[0][1])).not.to.throw();
  });

  it('opens the default report, and retains it when the browser cannot open', async () => {
    const open = $$.SANDBOX.stub(browser, 'open').resolves();
    const first = await TdcDashboard.run([]);
    expect(first.opened).to.equal(true);
    expect(open.calledOnceWithExactly(first.file)).to.equal(true);
    open.rejects(new Error('headless'));
    const second = await TdcDashboard.run([]);
    expect(second.opened).to.equal(false);
    expect(await readFile(second.file, 'utf8')).to.include('The collection book');
    await Promise.all([
      rm(path.dirname(first.file), { recursive: true }),
      rm(path.dirname(second.file), { recursive: true }),
    ]);
  });

  it('uses the saved ledger even when source files have changed', async () => {
    const file = path.join(root, '.tdc/ledger.json');
    const before = await readFile(file, 'utf8');
    await writeSources(root, { 'classes/AccountService.cls': SOURCE.replace("System.debug('test');", '') });
    const result = await TdcDashboard.run(['--output', 'saved.html']);
    expect(result.debt).to.equal(5);
    expect(await readFile(file, 'utf8')).to.equal(before);
  });

  it('excludes repricing from payments and forecasts only within the latest baseline', async () => {
    commitAll(root, 'Alice', 'chore: baseline', '2026-10-01T10:00:00Z');
    const project = await loadProject(root);
    await writeSources(root, { 'classes/AccountService.cls': SOURCE.replace("System.debug('test');", '') });
    await TdcScan.run([]);
    commitAll(root, 'Alice', 'fix: debug', '2026-10-02T10:00:00Z');
    const first = await dashboardData(project);
    expect(first.history[1].paid).to.equal(5);
    expect(first.forecast).not.to.equal(undefined);
    await writeSources(root, { 'classes/AccountService.cls': SOURCE });
    project.config.severityCosts.Low = 10;
    await writeFile(project.configFile, JSON.stringify(project.config));
    await TdcScan.run([]);
    commitAll(root, 'Alice', 'chore: reprice', '2026-10-03T10:00:00Z');
    const result = await dashboardData(await loadProject(root));
    expect(result.history[2]).to.include({ kind: 'rules-changed', paid: 0, created: 0, coins: 0 });
    expect(result.forecast).to.equal(undefined);
  });

  it('ranks the collectors without their emails or the snippets of their commits', async () => {
    commitAll(root, 'Alice', 'chore: baseline', '2026-10-01T10:00:00Z');
    await writeSources(root, { 'classes/AccountService.cls': SOURCE.replace("System.debug('test');", '') });
    await TdcScan.run([]);
    commitAll(root, 'Bob', 'fix: debug', '2026-10-02T10:00:00Z');
    const data = await dashboardData(await loadProject(root));
    expect(data.players).to.have.length(1);
    expect(data.players[0]).to.include({ author: 'Bob', coins: 5, paid: 5, rank: 'Intern' });
    expect(data.history[1]).to.include({ coins: 5 });
    expect(data.history[1].paidFindings[0]).to.have.all.keys('id', 'rule', 'file', 'cost');
    expect(JSON.stringify(data.players)).not.to.include('@');
  });

  it('sums the collectors into the team and leaves names out when the leaderboard is "team"', async () => {
    commitAll(root, 'Alice', 'chore: baseline', '2026-10-01T10:00:00Z');
    await writeSources(root, { 'classes/AccountService.cls': SOURCE.replace("System.debug('test');", '') });
    await TdcScan.run([]);
    commitAll(root, 'Bob', 'fix: debug', '2026-10-02T10:00:00Z');
    await writeFile(path.join(root, '.tdc/config.json'), JSON.stringify({ game: { leaderboard: 'team' } }));
    const data = await dashboardData(await loadProject(root));
    expect(data.players).to.have.length(1);
    expect(data.players[0]).to.include({ author: 'The team', coins: 5, paid: 5, rank: 'Intern' });
    expect(JSON.stringify(data)).not.to.match(/Alice|Bob/);
  });

  it('shows the debt that is not committed yet', async () => {
    commitAll(root, 'Alice', 'chore: baseline', '2026-10-01T10:00:00Z');
    await writeSources(root, { 'classes/AccountService.cls': SOURCE.replace("System.debug('test');", '') });
    await TdcScan.run([]);
    const data = await dashboardData(await loadProject(root));
    expect(data).to.include({ debt: 0, committedDebt: 5 });
  });

  it('keeps untrusted code and commit strings inside the JSON data block', async () => {
    const data = await dashboardData(await loadProject(root));
    const attack = '</script><script>alert("injection")</script><img src=x onerror=alert(1)>';
    data.project = attack;
    data.findings[0].snippet = attack;
    const html = renderDashboard(data);
    expect(html).not.to.include(attack);
    const embedded = /<script id="tdc-data" type="application\/json">([\s\S]*?)<\/script>/.exec(html)!;
    const decoded = JSON.parse(embedded[1]) as typeof data;
    expect(decoded.project).to.equal(attack);
    expect(decoded.findings[0].snippet).to.equal(attack);
  });

  it('keeps declared debt outside the measured balance and never runs its prompt verifier', async () => {
    const dir = path.join(root, '.tdc/debts');
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, 'declared.json'),
      JSON.stringify({
        id: 'declared',
        source: 'agent',
        status: 'confirmed',
        title: 'Separate responsibilities',
        description: 'Extract persistence',
        category: 'Design',
        severity: 'High',
        cost: 30,
        anchors: [{ file: 'force-app/main/default/classes/AccountService.cls', snippet: SOURCE }],
        verifier: { kind: 'prompt', prompt: 'Is persistence mixed with orchestration?' },
      })
    );
    const data = await dashboardData(await loadProject(root));
    expect(data.debt).to.equal(5);
    expect(data.declared).to.have.length(1);
    expect(data.declared[0]).to.include({ source: 'agent', cost: 30 });
  });

  it('describes each finding from the catalog that the scan writes, without changing it on a new scan', async () => {
    const file = path.join(root, '.tdc/catalog.json');
    const catalog = await readFile(file, 'utf8');
    expect(catalog).to.include('"pmd:AvoidDebugStatements": {"category":"Performance","severity":"Low"');
    await TdcScan.run([]);
    expect(await readFile(file, 'utf8')).to.equal(catalog);

    const data = await dashboardData(await loadProject(root));
    expect(data.catalog).to.equal(true);
    expect(data.findings[0]).to.include({
      problem: 'Description of pmd:AvoidDebugStatements',
      category: 'Performance',
      severity: 'Low',
      url: 'https://example.com/rules/pmd:AvoidDebugStatements',
      line: 1,
    });

    await rm(file);
    const bare = await dashboardData(await loadProject(root));
    expect(bare.catalog).to.equal(false);
    expect(bare.findings[0]).to.include({ problem: 'pmd:AvoidDebugStatements', line: 1 });
    expect(bare.findings[0]).not.to.have.property('category');
  });

  it('finds the line of each identical finding again by its rank, and none once the source changed', async () => {
    const debug = "    System.debug('x');";
    await writeSources(root, {
      'classes/AccountService.cls': ['class A {', debug, '  void b() {}', debug, '}'].join('\n'),
    });
    await TdcScan.run([]);
    const data = await dashboardData(await loadProject(root));
    expect(data.findings.map((finding) => finding.line).sort()).to.deep.equal([2, 4]);

    await writeSources(root, { 'classes/AccountService.cls': 'class A {}' });
    const changed = await dashboardData(await loadProject(root));
    expect(changed.findings.every((finding) => finding.line === undefined)).to.equal(true);
  });

  it('explains a missing ledger and supports a saved ledger without Git history', async () => {
    await rm(path.join(root, '.tdc/ledger.json'));
    await rm(path.join(root, '.git'), { recursive: true });
    const project = await loadProject(root);
    try {
      await dashboardData(project);
      expect.fail('missing ledger must fail');
    } catch (error) {
      expect((error as Error).message).to.include('sf tdc scan');
    }
    await TdcScan.run([]);
    const result = await dashboardData(project);
    expect(result).to.include({ debt: 5, branch: 'Outside Git' });
    expect(result.history).to.deep.equal([]);
  });
});
