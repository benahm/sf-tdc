import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { compareLedgers, parseLedger, readLedger, sameRules, type Ledger } from '../ledger/ledger.js';
import { git, showFile } from '../project/git.js';
import { toPosix, type Project } from '../project/project.js';
import { scan, toLedger, type Finding } from '../scan/engine.js';
import { changedFiles, findCheats, type Cheat } from './cheats.js';
import {
  DebtError,
  locate,
  readDeclaredDebts,
  writeDeclaredDebt,
  type DeclaredDebt,
  type Verdict,
} from './declared.js';
import { unanimous, verify } from './verifier.js';

/** A debt to fix, whatever found it: enough for an agent to act without reading anything else. */
export type WorkItem = {
  id: string;
  source: 'code-analyzer' | DeclaredDebt['source'];
  cost: number;
  /** `engine:rule` of code-analyzer, or `declared:<category>`. */
  rule: string;
  problem: string;
  file: string;
  line?: number;
  snippet: string;
  /** The command that tells whether it is fixed. */
  verify: string;
};

/**
 * - `paid`: the debt is gone, and nothing hid it;
 * - `present`: the debt is still there;
 * - `moved`: the debt is gone from its file but found again in another one: neither paid nor created;
 * - `deleted`: the debt went away with its file: not a payment;
 * - `suppressed`: the debt is gone, but a suppression or a change of configuration hid it;
 * - `unclear`: the prompt verifier did not agree with itself.
 */
export type VerifyStatus = 'paid' | 'present' | 'moved' | 'deleted' | 'suppressed' | 'unclear';

export type VerifyItem = {
  id: string;
  source: WorkItem['source'];
  file: string;
  status: VerifyStatus;
  verdicts?: Verdict[];
};

export type Verification = {
  passed: boolean;
  /** What the code is compared with: the ledger of HEAD, or the ledger on disk outside of git. */
  base: string;
  results: VerifyItem[];
  /** Debt that the changes created. */
  created: WorkItem[];
  cheats: Cheat[];
  warnings: string[];
  nextSteps: string[];
};

const verifyCommand = (id: string): string => `sf tdc verify --id ${id}`;

const fromFinding = (finding: Finding): WorkItem => ({
  id: finding.id,
  source: 'code-analyzer',
  cost: finding.cost,
  rule: finding.rule,
  problem: finding.message,
  file: finding.file,
  ...(finding.line ? { line: finding.line } : {}),
  snippet: finding.snippet,
  verify: verifyCommand(finding.id),
});

const fromDeclared = async (project: Project, debt: DeclaredDebt): Promise<WorkItem> => {
  const [anchor] = debt.anchors;
  let line: number | undefined;
  try {
    line = locate(await readFile(path.join(project.root, anchor.file), 'utf8'), anchor.snippet);
  } catch {
    // the file is gone
  }
  return {
    id: debt.id,
    source: debt.source,
    cost: debt.cost,
    rule: `declared:${debt.category}`,
    problem: `${debt.title}: ${debt.description}`,
    file: anchor.file,
    ...(line ? { line } : {}),
    snippet: anchor.snippet,
    verify: verifyCommand(debt.id),
  };
};

/** Most expensive first, then by place: two agents asking at the same time get the same work. */
const byPriority = (a: WorkItem, b: WorkItem): number =>
  b.cost - a.cost || a.file.localeCompare(b.file) || (a.line ?? 0) - (b.line ?? 0) || a.id.localeCompare(b.id);

/** The debt of the rules and the confirmed declared debt, in one queue. */
export const workQueue = async (project: Project): Promise<WorkItem[]> => {
  const [result, declared] = await Promise.all([scan(project), readDeclaredDebts(project)]);
  const items = [
    ...result.findings.map(fromFinding),
    ...(await Promise.all(
      declared.filter((debt) => debt.status === 'confirmed').map((debt) => fromDeclared(project, debt))
    )),
  ];
  return items.sort(byPriority);
};

/** Full ids from ids or unique prefixes of them, as git does with commits. */
export const resolveIds = (wanted: string[], known: Iterable<string>): string[] => {
  const ids = [...new Set(known)];
  return wanted.map((prefix) => {
    const matches = ids.filter((id) => id.startsWith(prefix.toLowerCase()));
    if (matches.length === 1) return matches[0];
    throw matches.length
      ? new DebtError('AMBIGUOUS_ID', `${prefix} matches ${matches.length} debts`, 'Give more characters of the id')
      : new DebtError('UNKNOWN_ID', `no debt has the id ${prefix}`, 'Take the id from `sf tdc next --json`');
  });
};

const hasHead = async (project: Project): Promise<boolean> => {
  if (!project.gitRoot) return false;
  try {
    await git(project.root, ['rev-parse', '--verify', 'HEAD^{commit}']);
    return true;
  } catch {
    return false;
  }
};

const baseLedger = async (project: Project, useHead: boolean): Promise<{ ledger: Ledger; base: string }> => {
  if (useHead) {
    const content = await showFile(project.root, 'HEAD', toPosix(path.relative(project.gitRoot!, project.ledgerFile)));
    if (content !== undefined) return { ledger: parseLedger(content), base: 'HEAD' };
  }
  const stored = await readLedger(project.ledgerFile);
  if (stored) return { ledger: stored, base: toPosix(path.relative(project.root, project.ledgerFile)) };
  throw new DebtError(
    'NO_LEDGER',
    'there is no ledger to compare with',
    'Run `sf tdc scan` and commit .tdc/ledger.json'
  );
};

const DONE = 'Run `sf tdc scan`, then commit the fix with .tdc/ledger.json and .tdc/debts';

const at = (file: string, line?: number): string => (line ? `${file}:${line}` : file);

/** What an agent does when the verification failed, most urgent first. */
const stepsAfterFailure = (
  results: VerifyItem[],
  failed: VerifyItem[],
  created: WorkItem[],
  cheats: Cheat[]
): string[] => [
  ...cheats.map((cheat) => `${at(cheat.file, cheat.line)}: ${cheat.fix}`),
  ...created.map((item) => `Fix ${item.id} (${item.rule}) created at ${at(item.file, item.line)}`),
  ...failed.map((item) =>
    item.status === 'unclear'
      ? `The verifier of ${item.id} did not agree with itself: make the fix more obvious, or ask a person to review it`
      : `Fix ${item.id} in ${item.file}: it is ${item.status}`
  ),
  `Then run \`sf tdc verify${results.map((item) => ` --id ${item.id}`).join('')}\``,
];

/** Asks the verifier of a declared debt, and marks the debt fixed when it is paid. */
const verifyDeclared = async (
  project: Project,
  debt: DeclaredDebt,
  hidden: (file: string) => boolean
): Promise<VerifyItem> => {
  const verdicts = await verify(project, debt);
  let status: VerifyStatus = unanimous(verdicts, 'fixed')
    ? 'paid'
    : unanimous(verdicts, 'present')
      ? 'present'
      : 'unclear';
  if (status === 'paid' && debt.anchors.some((anchor) => hidden(anchor.file))) status = 'suppressed';
  if (status === 'paid') await writeDeclaredDebt(project, { ...debt, status: 'fixed' });
  return { id: debt.id, source: debt.source, file: debt.anchors[0].file, status, verdicts };
};

/**
 * Whether the changes since HEAD paid the debt they were meant to pay, created none, and hid none. Without ids, every
 * debt that the changes touched is verified.
 */
export const verifyChanges = async (project: Project, ids: string[] = []): Promise<Verification> => {
  const useHead = await hasHead(project);
  const [{ ledger: before, base }, result, declared] = await Promise.all([
    baseLedger(project, useHead),
    scan(project),
    readDeclaredDebts(project),
  ]);
  const now = toLedger(result);
  const { changed, deleted } = useHead
    ? await changedFiles(project, 'HEAD')
    : { changed: [], deleted: new Set<string>() };
  const cheats = useHead ? await findCheats(project, 'HEAD', changed) : [];
  const warnings: string[] = [];
  if (!useHead)
    warnings.push('Not in a git repository with commits: suppressions and changes of configuration are not checked.');
  if (!sameRules(before, now))
    warnings.push(`The rules, their costs or the engines changed since ${base}: every debt can look new.`);

  const changes = compareLedgers(before, now, deleted);
  const configChanged = cheats.some((cheat) => cheat.code === 'CONFIG_CHANGED');
  const hidden = (file: string): boolean => configChanged || cheats.some((cheat) => cheat.file === file);
  const open = declared.filter((debt) => debt.status === 'confirmed');
  const nowIds = new Set(now.findings.map((finding) => finding.id));
  const paidIds = new Set(changes.paid.map((finding) => finding.id));
  const deletedIds = new Set(changes.deleted.map((finding) => finding.id));
  const ruleDebt = new Map([...before.findings, ...now.findings].map((finding) => [finding.id, finding]));
  const declaredById = new Map(open.map((debt) => [debt.id, debt]));

  const targets = ids.length
    ? resolveIds(ids, [...ruleDebt.keys(), ...declared.map((debt) => debt.id)])
    : [
        ...[...changes.paid, ...changes.deleted].map((finding) => finding.id),
        ...open
          .filter((debt) =>
            [
              ...debt.anchors.map((anchor) => anchor.file),
              ...(debt.verifier.kind === 'pattern' ? [debt.verifier.file] : []),
            ].some((file) => changed.includes(file))
          )
          .map((debt) => debt.id),
      ];

  const ruleStatus = (id: string, file: string): VerifyStatus => {
    if (nowIds.has(id)) return 'present';
    if (deletedIds.has(id)) return 'deleted';
    if (paidIds.has(id)) return hidden(file) ? 'suppressed' : 'paid';
    return 'moved';
  };
  const results: VerifyItem[] = [];
  for (const id of targets) {
    const debt = declaredById.get(id);
    if (debt) {
      // eslint-disable-next-line no-await-in-loop
      results.push(await verifyDeclared(project, debt, hidden));
      continue;
    }
    const known = declared.find((item) => item.id === id);
    if (known) {
      throw new DebtError(
        'NOT_OPEN',
        `${id} is already ${known.status}`,
        'Take an open debt from `sf tdc next --json`'
      );
    }
    const { file } = ruleDebt.get(id)!;
    results.push({ id, source: 'code-analyzer', file, status: ruleStatus(id, file) });
  }

  const findingsById = new Map(result.findings.map((finding) => [finding.id, finding]));
  const created = changes.created.map((finding) => fromFinding(findingsById.get(finding.id)!)).sort(byPriority);
  const failed = results.filter((item) => ['present', 'suppressed', 'unclear'].includes(item.status));
  const passed = cheats.length === 0 && created.length === 0 && failed.length === 0;

  const nextSteps = passed ? [DONE] : stepsAfterFailure(results, failed, created, cheats);
  return { passed, base, results, created, cheats, warnings, nextSteps };
};
