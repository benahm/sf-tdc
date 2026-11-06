import path from 'node:path';

import { readDeclaredDebts } from '../debt/declared.js';
import { BADGE_CATALOG, buildLeaderboard, RANKS, type Badge, type Player } from '../game/leaderboard.js';
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

/** A finding of a commit, without its snippet: a large history must not make the report heavy. */
export type DashboardChange = Pick<LedgerFinding, 'id' | 'rule' | 'file' | 'cost'>;

/** A player of the leaderboard, without email or payments: the report is meant to be shared. */
export type DashboardPlayer = Pick<
  Player,
  'author' | 'coins' | 'paid' | 'created' | 'deleted' | 'commits' | 'rank' | 'nextRank'
> & { badges: string[] };

export type DashboardData = {
  version: number;
  project: string;
  generatedAt: string;
  branch: string;
  commit?: string;
  /** Debt of the ledger on disk. */
  debt: number;
  /** Debt of the last committed ledger, when there is one: the difference is not committed yet. */
  committedDebt?: number;
  price: Price;
  goal?: Goal;
  forecast?: Forecast;
  findings: DashboardFinding[];
  declared: DashboardFinding[];
  players: DashboardPlayer[];
  ranks: Array<{ name: string; minCoins: number }>;
  badges: Badge[];
  history: Array<{
    sha: string;
    date: string;
    subject: string;
    author: string;
    kind: CommitKind;
    debt: number;
    coins: number;
    paid: number;
    created: number;
    deleted: number;
    moved: number;
    paidFindings: DashboardChange[];
    createdFindings: DashboardChange[];
  }>;
};

const change = ({ id, rule, file, cost }: LedgerFinding): DashboardChange => ({ id, rule, file, cost });

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
    version: 2,
    project: path.basename(project.root),
    generatedAt: new Date().toISOString(),
    branch,
    commit,
    debt,
    committedDebt: events.at(-1)?.debt,
    price: price(debt, project.config),
    goal: project.config.goal,
    forecast: comparable.length >= 2 ? forecast(comparable, project.config.goal) : undefined,
    findings: ledger.findings.map((finding) => ({
      id: finding.id,
      source: 'code-analyzer',
      rule: finding.rule,
      file: finding.file,
      snippet: finding.snippet,
      cost: finding.cost,
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
    players: buildLeaderboard(events).map((player) => ({
      author: player.author,
      coins: player.coins,
      paid: player.paid,
      created: player.created,
      deleted: player.deleted,
      commits: player.commits,
      rank: player.rank,
      nextRank: player.nextRank,
      badges: player.badges.map((badge) => badge.id),
    })),
    ranks: RANKS.map((rank) => ({ name: rank.name, minCoins: Math.max(rank.minCoins, 0) })),
    badges: BADGE_CATALOG,
    history: events.map((event) => ({
      sha: event.sha,
      date: event.date,
      subject: event.subject,
      author: event.author,
      kind: event.kind,
      debt: event.debt,
      coins: event.coins,
      paid: event.kind === 'scored' ? totalCost(event.paid) : 0,
      created: event.kind === 'scored' ? totalCost(event.created) : 0,
      deleted: totalCost(event.deleted),
      moved: event.moved,
      paidFindings: event.kind === 'scored' ? event.paid.map(change) : [],
      createdFindings: event.kind === 'scored' ? event.created.map(change) : [],
    })),
  };
};
