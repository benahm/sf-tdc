import path from 'node:path';

import { readDeclaredDebts } from '../debt/declared.js';
import { forecast, price, type Forecast, type Price } from '../game/score.js';
import { readHistory, type CommitKind } from '../ledger/history.js';
import { readLedger, totalCost, type LedgerFinding } from '../ledger/ledger.js';
import { git } from '../project/git.js';
import type { Goal, Project } from '../project/project.js';

export type DashboardFinding = {
  id: string;
  source: string;
  rule: string;
  file: string;
  snippet: string;
  cost: number;
  problem: string;
  line?: number;
  category?: string;
  severity?: string;
};

export type DashboardData = {
  version: number;
  project: string;
  generatedAt: string;
  source: string;
  branch: string;
  commit?: string;
  debt: number;
  price: Price;
  goal?: Goal;
  forecast?: Forecast;
  findings: DashboardFinding[];
  declared: DashboardFinding[];
  history: Array<{
    sha: string;
    date: string;
    subject: string;
    author: string;
    kind: CommitKind;
    debt: number;
    paid: number;
    created: number;
    deleted: number;
    moved: number;
    paidFindings: LedgerFinding[];
    createdFindings: LedgerFinding[];
  }>;
};

/** A portable snapshot: opening the report never scans code or runs a verifier. */
export const dashboardData = async (project: Project): Promise<DashboardData> => {
  const ledger = await readLedger(project.ledgerFile);
  if (!ledger) throw new Error('No ledger found. Run sf tdc scan first.');
  const [events, declared] = await Promise.all([
    project.gitRoot ? readHistory(project) : [],
    readDeclaredDebts(project),
  ]);
  let branch = 'Outside Git';
  let commit: string | undefined;
  if (project.gitRoot) {
    try {
      branch = await git(project.root, ['branch', '--show-current']);
      commit = await git(project.root, ['rev-parse', '--short', 'HEAD']);
      branch = branch.trim() || 'Detached HEAD';
      commit = commit.trim();
    } catch {
      branch = 'No commits yet';
    }
  }
  // Forecast only within the latest measurement baseline. A repricing is not a repayment.
  const baseline = events.findLastIndex((event) => event.kind !== 'scored');
  const comparable = events.slice(Math.max(baseline, 0));
  const debt = totalCost(ledger.findings);
  return {
    version: 1,
    project: path.basename(project.root),
    generatedAt: new Date().toISOString(),
    source: 'Ledger on disk (may not be committed)',
    branch,
    commit,
    debt,
    price: price(debt, project.config),
    goal: project.config.goal,
    forecast: comparable.length >= 2 ? forecast(comparable, project.config.goal) : undefined,
    findings: ledger.findings.map((finding) => ({
      ...finding,
      source: 'code-analyzer',
      problem: finding.rule,
    })),
    declared: declared
      .filter((item) => item.status === 'confirmed')
      .map((item) => ({
        id: item.id,
        source: item.source,
        category: item.category,
        severity: item.severity,
        file: item.anchors[0].file,
        snippet: item.anchors[0].snippet,
        rule: `declared:${item.category}`,
        cost: item.cost,
        problem: `${item.title}: ${item.description}`,
      })),
    history: events.map((event) => ({
      sha: event.sha,
      date: event.date,
      subject: event.subject,
      author: event.author,
      kind: event.kind,
      debt: event.debt,
      paid: event.kind === 'scored' ? totalCost(event.paid) : 0,
      created: event.kind === 'scored' ? totalCost(event.created) : 0,
      deleted: totalCost(event.deleted),
      moved: event.moved,
      paidFindings: event.kind === 'scored' ? event.paid : [],
      createdFindings: event.kind === 'scored' ? event.created : [],
    })),
  };
};
