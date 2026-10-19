import path from 'node:path';

import { git, showFile } from '../project/git.js';
import { toPosix, type Project } from '../project/project.js';
import {
  compareLedgers,
  EMPTY_LEDGER,
  parseLedger,
  sameRules,
  totalCost,
  type LedgerChanges,
  type LedgerFinding,
} from './ledger.js';

export type CommitInfo = {
  sha: string;
  author: string;
  email: string;
  /** ISO 8601 author date. */
  date: string;
  subject: string;
};

/**
 * - `baseline`: the first ledger of the history: its debt was not created by the commit.
 * - `rules-changed`: rules or costs changed: the debt is re-baselined, nobody wins or loses coins.
 * - `scored`: the commit paid or created debt.
 */
export type CommitKind = 'baseline' | 'rules-changed' | 'scored';

export type CommitEvent = CommitInfo &
  LedgerChanges & {
    kind: CommitKind;
    /** Debt after the commit. */
    debt: number;
    coins: number;
  };

const FIELD = '\x1f';

const parseLog = (output: string): Array<CommitInfo & { parent?: string }> =>
  output
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      const [sha, parents, author, email, date, subject] = line.split(FIELD);
      return { sha, parent: parents.split(' ')[0] || undefined, author, email, date, subject };
    })
    .reverse();

/**
 * The debt changes of every commit that changed the ledger, oldest first. Merge commits are skipped: the commits of
 * the merged branch are already counted, and with a squash merge the squashed commit is what is counted.
 */
export const readHistory = async (project: Project, options: { since?: string } = {}): Promise<CommitEvent[]> => {
  const repoRoot = project.gitRoot;
  if (!repoRoot) throw new Error('The project is not in a git repository: the history of the debt comes from git.');
  const ledgerPath = toPosix(path.relative(repoRoot, project.ledgerFile));
  const prefix = toPosix(path.relative(repoRoot, project.root));
  const toProjectPath = (gitPath: string): string => (prefix ? gitPath.slice(prefix.length + 1) : gitPath);

  let log: string;
  try {
    log = await git(repoRoot, [
      'log',
      '--no-merges',
      '--full-history',
      `--format=%H${FIELD}%P${FIELD}%aN${FIELD}%aE${FIELD}%aI${FIELD}%s`,
      ...(options.since ? [`--since=${options.since}`] : []),
      '--',
      ledgerPath,
    ]);
  } catch {
    // a repository without commits
    return [];
  }

  const readCommit = async ({ parent, ...commit }: CommitInfo & { parent?: string }): Promise<CommitEvent[]> => {
    const [afterContent, beforeContent, deleted] = await Promise.all([
      showFile(repoRoot, commit.sha, ledgerPath),
      parent ? showFile(repoRoot, parent, ledgerPath) : undefined,
      git(repoRoot, ['diff-tree', '--root', '--no-commit-id', '-r', '--name-only', '--diff-filter=D', commit.sha]),
    ]);
    // the commit deleted the ledger
    if (afterContent === undefined) return [];
    const after = parseLedger(afterContent);
    const before = beforeContent === undefined ? EMPTY_LEDGER : parseLedger(beforeContent);
    const kind: CommitKind =
      beforeContent === undefined ? 'baseline' : sameRules(before, after) ? 'scored' : 'rules-changed';
    const deletedFiles = new Set(
      deleted
        .split('\n')
        .filter((file) => file && (!prefix || file.startsWith(`${prefix}/`)))
        .map(toProjectPath)
    );
    const changes = compareLedgers(before, after, deletedFiles);
    const reward = totalCost(changes.paid) + (project.config.game.rewardDeletedFiles ? totalCost(changes.deleted) : 0);
    return [
      {
        ...commit,
        ...changes,
        kind,
        debt: totalCost(after.findings),
        coins: kind === 'scored' ? reward - totalCost(changes.created) : 0,
      },
    ];
  };

  const events: CommitEvent[] = [];
  for (const commit of parseLog(log)) {
    // one commit at a time: a long history would otherwise start thousands of git processes at once
    // eslint-disable-next-line no-await-in-loop
    events.push(...(await readCommit(commit)));
  }
  return events;
};

/** Paid findings of an event, with the commit that paid them. */
export const payments = (event: CommitEvent): Array<LedgerFinding & { sha: string; date: string }> =>
  event.kind === 'scored' ? event.paid.map((finding) => ({ ...finding, sha: event.sha, date: event.date })) : [];
