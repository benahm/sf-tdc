import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { locate, readDeclaredDebts } from '../debt/declared.js';
import { buildLeaderboard, RANKS, teamOf, type Player } from '../game/leaderboard.js';
import { forecast, price, type Forecast, type Price } from '../game/score.js';
import { readCatalog } from '../ledger/catalog.js';
import { readHistory, type CommitKind } from '../ledger/history.js';
import { parseLedger, readLedger, totalCost, type LedgerFinding } from '../ledger/ledger.js';
import { git, showFile } from '../project/git.js';
import { toPosix, type Goal, type Project } from '../project/project.js';
import { findingId, snippetOf } from '../scan/engine.js';

export type DashboardFinding = {
  id: string;
  source: string;
  rule: string;
  file: string;
  snippet: string;
  cost: number;
  /** The description of the rule when the catalog has it, the rule otherwise; the title of a declared debt. */
  problem: string;
  /** Found again in the current source: the ledger has no line numbers. */
  line?: number;
  category?: string;
  severity?: string;
  /** Documentation of the rule. */
  url?: string;
};

/** A finding of a commit, without its snippet: a large history must not make the report heavy. */
export type DashboardChange = Pick<LedgerFinding, 'id' | 'rule' | 'file' | 'cost'>;

/** A player of the leaderboard, without email: the report is meant to be shared. */
export type DashboardPlayer = Pick<
  Player,
  'author' | 'coins' | 'paid' | 'created' | 'deleted' | 'commits' | 'rank' | 'nextRank'
>;

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
  /** Whether .tdc/catalog.json described the rules: without it, findings show their rule ids. */
  catalog: boolean;
  /** One player named after the team when the leaderboard is "team". */
  players: DashboardPlayer[];
  ranks: Array<{ name: string; minCoins: number }>;
  history: Array<{
    sha: string;
    date: string;
    subject: string;
    /** Empty when the leaderboard is "team". */
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

const readSource = async (project: Project, file: string): Promise<string | undefined> => {
  try {
    return await readFile(path.join(project.root, file), 'utf8');
  } catch {
    return undefined;
  }
};

/**
 * The line of each finding in the current source, by its snippet. Identical snippets of a file are told apart by the
 * rank in the id of the finding; a source changed since the scan can give no line, or another one.
 */
const locateFindings = async (project: Project, findings: LedgerFinding[]): Promise<Map<string, number>> => {
  const byFile = new Map<string, LedgerFinding[]>();
  for (const finding of findings) {
    if (finding.snippet) byFile.set(finding.file, [...(byFile.get(finding.file) ?? []), finding]);
  }
  const located = new Map<string, number>();
  await Promise.all(
    [...byFile].map(async ([file, items]) => {
      const content = await readSource(project, file);
      if (content === undefined) return;
      const snippets = content.split(/\r?\n/).map(snippetOf);
      const sameHash = new Map<string, number>();
      for (const item of items) sameHash.set(item.hash, (sameHash.get(item.hash) ?? 0) + 1);
      for (const item of items) {
        const matches = snippets.flatMap((snippet, index) => (snippet === item.snippet ? [index + 1] : []));
        if (!matches.length) continue;
        const count = sameHash.get(item.hash) ?? 1;
        let rank = 0;
        while (rank < count && findingId(file, item.hash, rank) !== item.id) rank++;
        located.set(item.id, matches[Math.min(rank < count ? rank : 0, matches.length - 1)]);
      }
    })
  );
  return located;
};

const readCommittedDebt = async (project: Project): Promise<number | undefined> => {
  if (!project.gitRoot) return undefined;
  const content = await showFile(project.gitRoot, 'HEAD', toPosix(path.relative(project.gitRoot, project.ledgerFile)));
  if (content === undefined) return undefined;
  try {
    return totalCost(parseLedger(content).findings);
  } catch {
    // The history reader reports the invalid commit.
    return undefined;
  }
};

/** A portable snapshot: opening the report never scans code or runs a verifier. */
export const dashboardData = async (
  project: Project,
  onWarning?: (warning: string) => void
): Promise<DashboardData> => {
  const ledger = await readLedger(project.ledgerFile);
  if (!ledger) throw new Error('No ledger found. Run sf tdc scan first.');
  const [events, committedDebt, declared, catalog, lines] = await Promise.all([
    project.gitRoot ? readHistory(project, { onWarning }) : [],
    readCommittedDebt(project),
    readDeclaredDebts(project),
    readCatalog(project.catalogFile),
    locateFindings(project, ledger.findings),
  ]);
  const open = declared.filter((item) => item.status === 'confirmed');
  const declaredLines = await Promise.all(
    open.map(async (item) => {
      const content = await readSource(project, item.anchors[0].file);
      return content === undefined ? undefined : locate(content, item.anchors[0].snippet);
    })
  );
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
  const team = project.config.game.leaderboard === 'team';
  const players = buildLeaderboard(events);
  return {
    version: 3,
    project: path.basename(project.root),
    generatedAt: new Date().toISOString(),
    branch,
    commit,
    debt,
    committedDebt,
    price: price(debt, project.config),
    goal: project.config.goal,
    forecast: comparable.length >= 2 ? forecast(comparable, project.config.goal) : undefined,
    findings: ledger.findings.map((finding) => {
      const rule = catalog?.rules[finding.rule];
      const line = lines.get(finding.id);
      return {
        id: finding.id,
        source: 'code-analyzer',
        rule: finding.rule,
        file: finding.file,
        snippet: finding.snippet,
        cost: finding.cost,
        problem: rule?.summary ?? finding.rule,
        ...(line ? { line } : {}),
        ...(rule ? { category: rule.category, severity: rule.severity } : {}),
        ...(rule?.url ? { url: rule.url } : {}),
      };
    }),
    declared: open.map((item, index) => ({
      id: item.id,
      source: item.source,
      category: item.category,
      severity: item.severity,
      file: item.anchors[0].file,
      ...(declaredLines[index] ? { line: declaredLines[index] } : {}),
      snippet: item.anchors[0].snippet,
      rule: `declared:${item.category}`,
      cost: item.cost,
      problem: `${item.title}: ${item.description}`,
    })),
    catalog: catalog !== undefined,
    players: (team ? (players.length ? [teamOf(players, 'The team')] : []) : players).map((player) => ({
      author: player.author,
      coins: player.coins,
      paid: player.paid,
      created: player.created,
      deleted: player.deleted,
      commits: player.commits,
      rank: player.rank,
      nextRank: player.nextRank,
    })),
    ranks: RANKS.map((rank) => ({ name: rank.name, minCoins: Math.max(rank.minCoins, 0) })),
    history: events.map((event) => ({
      sha: event.sha,
      date: event.date,
      subject: event.subject,
      author: team ? '' : event.author,
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
