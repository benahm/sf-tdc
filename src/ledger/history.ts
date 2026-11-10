import path from 'node:path';

import { git, showFile } from '../project/git.js';
import { toPosix, type Project } from '../project/project.js';
import {
  compareLedgers,
  EMPTY_LEDGER,
  parseLedger,
  sameRules,
  totalCost,
  type Ledger,
  type LedgerChanges,
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
 * - `baseline`: the first ledger or the first valid ledger after a gap in the history.
 * - `rules-changed`: rules or costs changed: the debt is re-baselined, nobody wins or loses coins.
 * - `merge`: the merged ledger is shown as a balance, with the branch commits scored separately.
 * - `scored`: the commit paid or created debt.
 */
export type CommitKind = 'baseline' | 'rules-changed' | 'merge' | 'scored';

export type CommitEvent = CommitInfo &
  LedgerChanges & {
    kind: CommitKind;
    /** Debt after the commit. */
    debt: number;
    coins: number;
  };

const FIELD = '\x1f';

type HistoryCommit = CommitInfo & { parents: string[] };

const parseLog = (output: string): HistoryCommit[] =>
  output
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      const [sha, parents, author, email, date, subject] = line.split(FIELD);
      return { sha, parents: parents ? parents.split(' ') : [], author, email, date, subject };
    })
    .reverse();

/**
 * The ledger changes in ancestry order. Merges record the resulting balance without scoring either parent's changes.
 */
export const readHistory = async (
  project: Project,
  options: { since?: string; onWarning?: (warning: string) => void } = {}
): Promise<CommitEvent[]> => {
  const repoRoot = project.gitRoot;
  if (!repoRoot) throw new Error('The project is not in a git repository: the history of the debt comes from git.');
  const ledgerPath = toPosix(path.relative(repoRoot, project.ledgerFile));
  const prefix = toPosix(path.relative(repoRoot, project.root));
  const toProjectPath = (gitPath: string): string => (prefix ? gitPath.slice(prefix.length + 1) : gitPath);

  let log: string;
  try {
    log = await git(repoRoot, [
      'log',
      '--full-history',
      '--topo-order',
      `--format=%H${FIELD}%P${FIELD}%aN${FIELD}%aE${FIELD}%aI${FIELD}%s`,
      ...(options.since ? [`--since=${options.since}`] : []),
      '--',
      ledgerPath,
    ]);
  } catch {
    // a repository without commits
    return [];
  }

  const invalid = new Set<string>();
  const readAt = async (sha: string): Promise<Ledger | undefined> => {
    if (invalid.has(sha)) return undefined;
    const content = await showFile(repoRoot, sha, ledgerPath);
    if (content === undefined) return undefined;
    try {
      return parseLedger(content);
    } catch {
      if (!invalid.has(sha))
        options.onWarning?.(`Skipping invalid ledger in commit ${sha.slice(0, 12)} (${ledgerPath}).`);
      invalid.add(sha);
      return undefined;
    }
  };

  const readCommit = async ({ parents, ...commit }: HistoryCommit): Promise<CommitEvent[]> => {
    const [parent] = parents;
    const merge = parents.length > 1;
    const [after, before, deleted] = await Promise.all([
      readAt(commit.sha),
      parent && !merge ? readAt(parent) : undefined,
      merge
        ? ''
        : git(repoRoot, [
            'diff-tree',
            '--root',
            '--no-commit-id',
            '-r',
            '--find-renames',
            '--name-only',
            '-z',
            '--diff-filter=D',
            commit.sha,
          ]),
    ]);
    if (!after) return [];
    const kind: CommitKind = merge
      ? 'merge'
      : !before
        ? 'baseline'
        : sameRules(before, after)
          ? 'scored'
          : 'rules-changed';
    const deletedFiles = new Set(
      deleted
        .split('\0')
        .filter((file) => file && (!prefix || file.startsWith(`${prefix}/`)))
        .map(toProjectPath)
    );
    const changes = merge
      ? { paid: [], deleted: [], created: [], moved: 0 }
      : compareLedgers(before ?? EMPTY_LEDGER, after, deletedFiles);
    const reward = project.config.game.rewardDeletedFiles === true ? totalCost(changes.deleted) : 0;
    return [
      {
        ...commit,
        ...changes,
        kind,
        debt: totalCost(after.findings),
        coins: kind === 'scored' ? totalCost(changes.paid) + reward - totalCost(changes.created) : 0,
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
