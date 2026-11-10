import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  compareLedgers,
  parseLedger,
  sameRules,
  serializeLedger,
  totalCost,
  type Ledger,
  type LedgerChanges,
  type LedgerFinding,
} from '../ledger/ledger.js';
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
import { unanimous, VERIFIER_COMMAND_ENV, verify } from './verifier.js';

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
export type CheckStatus = 'paid' | 'present' | 'moved' | 'deleted' | 'suppressed' | 'unclear';

export type CheckItem = {
  id: string;
  source: WorkItem['source'];
  file: string;
  status: CheckStatus;
  verdicts?: Verdict[];
};

export type CheckOptions = {
  /** Git ref to compare with. Defaults to HEAD. */
  base?: string;
  /** Debt that must be paid: ids or unique prefixes. */
  ids?: string[];
  /** Highest debt allowed, in TDC. */
  maxDebt?: number;
};

export type Check = {
  passed: boolean;
  /** Debt of the code, in TDC. */
  debt: number;
  /** Whether .tdc/ledger.json matches the code. */
  ledgerUpToDate: boolean;
  /** The ref the code is compared with, when there is one. */
  base?: string;
  /** Changes since the base, in TDC; missing when there is no base ledger, or when the rules changed since. */
  sinceBase?: { paid: number; deleted: number; created: number; moved: number };
  /** The debt given with --id, or without it, the debt that the changes paid or touched. */
  results: CheckItem[];
  /** Debt that the changes created. */
  created: WorkItem[];
  cheats: Cheat[];
  /** Why the check failed: empty when it passed. */
  failures: string[];
  warnings: string[];
  /** What to do next, for an agent. */
  nextSteps: string[];
};

const checkCommand = (id: string): string => `sf tdc check --id ${id}`;

const fromFinding = (finding: Finding): WorkItem => ({
  id: finding.id,
  source: 'code-analyzer',
  cost: finding.cost,
  rule: finding.rule,
  problem: finding.message,
  file: finding.file,
  ...(finding.line ? { line: finding.line } : {}),
  snippet: finding.snippet,
  verify: checkCommand(finding.id),
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
    verify: checkCommand(debt.id),
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

/**
 * The commit to compare with: where the branch forked from `base`, so that what the target branch got since does not
 * count against the changes. Undefined without a git repository or without commits, when no base was asked for.
 */
const resolveBase = async (project: Project, base?: string): Promise<{ ref: string; commit: string } | undefined> => {
  if (!project.gitRoot) {
    if (base === undefined) return undefined;
    throw new DebtError(
      'NO_GIT',
      `cannot compare with ${base}: the project is not in a git repository`,
      'Run the command in a git repository, or without --base'
    );
  }
  const ref = base ?? 'HEAD';
  let commit: string;
  try {
    commit = (await git(project.root, ['rev-parse', '--verify', `${ref}^{commit}`])).trim();
  } catch {
    if (base === undefined) return undefined;
    throw new DebtError(
      'UNKNOWN_BASE',
      `${base} is not a commit of the repository`,
      'Give a branch, a tag or a commit, such as origin/main; in CI, fetch it first'
    );
  }
  try {
    commit = (await git(project.root, ['merge-base', commit, 'HEAD'])).trim();
  } catch {
    // no common ancestor, or a shallow clone: the base itself
  }
  return { ref, commit };
};

const readText = async (file: string): Promise<string | undefined> => {
  try {
    return (await readFile(file, 'utf8')).replace(/\r\n/g, '\n');
  } catch {
    return undefined;
  }
};

const at = (file: string, line?: number): string => (line ? `${file}:${line}` : file);

/** Asks the verifier of a declared debt, and marks the debt fixed when it is paid. */
const checkDeclared = async (
  project: Project,
  debt: DeclaredDebt,
  hidden: (file: string) => boolean
): Promise<CheckItem> => {
  const verdicts = await verify(project, debt);
  let status: CheckStatus = unanimous(verdicts, 'fixed')
    ? 'paid'
    : unanimous(verdicts, 'present')
      ? 'present'
      : 'unclear';
  if (status === 'paid' && debt.anchors.some((anchor) => hidden(anchor.file))) status = 'suppressed';
  if (status === 'paid') await writeDeclaredDebt(project, { ...debt, status: 'fixed' });
  return { id: debt.id, source: debt.source, file: debt.anchors[0].file, status, verdicts };
};

const NO_CHANGES: LedgerChanges = { paid: [], deleted: [], created: [], moved: 0 };

type Base = { ref: string; commit: string };
type SinceBase = NonNullable<Check['sinceBase']>;

const ledgerFailures = (ledgerFile: string, stored: string | undefined, upToDate: boolean): string[] => {
  if (stored === undefined) return [`${ledgerFile} is missing: run sf tdc scan and commit it`];
  return upToDate ? [] : [`${ledgerFile} is out of date: run sf tdc scan and commit it`];
};

const baseWarnings = (base: Base | undefined, before: Ledger | undefined, rulesChanged: boolean): string[] => {
  if (!base) return ['Not in a git repository with commits: only the ledger and --max-debt are checked.'];
  if (!before) return [`${base.ref} has no ledger: nothing to compare with.`];
  return rulesChanged
    ? [
        `The rules, their costs or the engines changed since ${base.ref}: the debt is re-baselined, its growth is not checked.`,
      ]
    : [];
};

/** The files changed since the base, and the changes that hide debt instead of paying it. */
const readChanges = async (
  project: Project,
  base: Base | undefined,
  scannedFiles: string[]
): Promise<{ changed: string[]; deleted: Set<string>; cheats: Cheat[] }> => {
  if (!base) return { changed: [], deleted: new Set<string>(), cheats: [] };
  const files = await changedFiles(project, base.commit);
  return { ...files, cheats: await findCheats(project, base.commit, files, scannedFiles) };
};

/** A suppression always fails; a change of configuration fails only when debt disappeared with it. */
const judgeCheats = (
  cheats: Cheat[],
  suppressed: LedgerFinding[],
  rulesChanged: boolean
): { failures: string[]; warnings: string[] } => {
  const failures = cheats
    .filter((cheat) => cheat.code === 'SUPPRESSION_ADDED')
    .map((cheat) => `${at(cheat.file, cheat.line)}: a suppression hides debt instead of paying it`);
  const configFiles = cheats
    .filter((cheat) => cheat.code === 'CONFIG_CHANGED')
    .map((cheat) => cheat.file)
    .join(', ');
  if (!configFiles) return { failures, warnings: [] };
  // a change of the rules is a re-baseline, seen in the pull request: other changes of configuration only fail when
  // debt disappeared with them
  if (suppressed.length && !rulesChanged) {
    failures.push(
      `${totalCost(suppressed)} TDC of debt disappeared while ${configFiles} changed: changing what is scanned is not paying debt`
    );
    return { failures, warnings: [] };
  }
  return { failures, warnings: [`${configFiles} changed: check that the change hides no debt.`] };
};

/** The changes since the base, in TDC, and whether the debt grew; nothing when the base cannot be compared. */
const growthSince = (
  base: Base | undefined,
  comparable: boolean,
  changes: LedgerChanges,
  paid: LedgerFinding[]
): { sinceBase?: SinceBase; failures: string[] } => {
  if (!base || !comparable) return { failures: [] };
  const sinceBase = {
    paid: totalCost(paid),
    deleted: totalCost(changes.deleted),
    created: totalCost(changes.created),
    moved: changes.moved,
  };
  const growth = sinceBase.created - sinceBase.paid - sinceBase.deleted;
  return {
    sinceBase,
    failures:
      growth > 0
        ? [
            `The debt grew by ${growth} TDC since ${base.ref}: ${sinceBase.created} TDC created, ${sinceBase.paid + sinceBase.deleted} TDC paid`,
          ]
        : [],
  };
};

/** The open declared debt whose anchors or pattern file the changes touched. */
const touchedDeclared = (open: DeclaredDebt[], changed: string[]): string[] =>
  open
    .filter((item) =>
      [
        ...item.anchors.map((anchor) => anchor.file),
        ...(item.verifier.kind === 'pattern' ? [item.verifier.file] : []),
      ].some((file) => changed.includes(file))
    )
    .map((item) => item.id);

type TargetContext = {
  project: Project;
  /** Whether the ids were given: their debt must be checked, whatever its verifier. */
  asked: boolean;
  declared: DeclaredDebt[];
  ruleDebt: Map<string, LedgerFinding>;
  ruleStatus: (id: string, file: string) => CheckStatus;
  hidden: (file: string) => boolean;
};

/** The status of each target, and the warnings of the declared debt that could not be checked. */
const checkTargets = async (
  targets: string[],
  context: TargetContext
): Promise<{ results: CheckItem[]; warnings: string[] }> => {
  const open = new Map(context.declared.filter((item) => item.status === 'confirmed').map((item) => [item.id, item]));
  const results: CheckItem[] = [];
  const warnings: string[] = [];
  for (const id of targets) {
    const declaredDebt = open.get(id);
    if (declaredDebt) {
      try {
        // eslint-disable-next-line no-await-in-loop
        results.push(await checkDeclared(context.project, declaredDebt, context.hidden));
      } catch (error) {
        // a debt the changes only touched: a CI without an agent still checks the rest
        if (context.asked || !(error instanceof DebtError && error.code === 'NO_VERIFIER_COMMAND')) throw error;
        warnings.push(`${id} has a prompt verifier and was skipped because ${VERIFIER_COMMAND_ENV} is unset.`);
      }
      continue;
    }
    const known = context.declared.find((item) => item.id === id);
    if (known) {
      throw new DebtError(
        'NOT_OPEN',
        `${id} is already ${known.status}`,
        'Take an open debt from `sf tdc next --json`'
      );
    }
    const { file } = context.ruleDebt.get(id)!;
    results.push({ id, source: 'code-analyzer', file, status: context.ruleStatus(id, file) });
  }
  return { results, warnings };
};

type NextStepsInput = {
  cheats: Cheat[];
  sinceBase?: SinceBase;
  created: WorkItem[];
  unpaid: CheckItem[];
  ledgerUpToDate: boolean;
  again: string;
};

/** What an agent does after a failed check. */
const nextStepsAfterFailure = ({
  cheats,
  sinceBase,
  created,
  unpaid,
  ledgerUpToDate,
  again,
}: NextStepsInput): string[] => [
  ...cheats.map((cheat) => `${at(cheat.file, cheat.line)}: ${cheat.fix}`),
  ...(sinceBase && sinceBase.created > sinceBase.paid + sinceBase.deleted
    ? created.map((item) => `Fix ${item.id} (${item.rule}) created at ${at(item.file, item.line)}`)
    : []),
  ...unpaid.map((item) =>
    item.status === 'unclear'
      ? `The verifier of ${item.id} did not agree with itself: make the fix more obvious, or ask a person to review it`
      : `Fix ${item.id} in ${item.file}: it is ${item.status}`
  ),
  ...(ledgerUpToDate ? [] : ['Run `sf tdc scan`']),
  `Then run \`${again}\``,
];

/**
 * Checks the code against the ledger and the base (HEAD by default): the ledger is up to date, the debt did not grow,
 * nothing hid debt, and the debt given with `ids` is paid. Without ids, the debt that the changes paid or touched is
 * listed, and only fails the check when it was hidden.
 */
export const checkChanges = async (project: Project, options: CheckOptions = {}): Promise<Check> => {
  const ids = options.ids ?? [];
  const base = await resolveBase(project, options.base);
  if (!base && ids.length) {
    throw new DebtError(
      'NO_BASE',
      'a debt is checked against the last commit, and there is none',
      'Commit the ledger first: sf tdc scan, then git commit'
    );
  }
  const [result, declared, stored, baseContent] = await Promise.all([
    scan(project),
    readDeclaredDebts(project),
    readText(project.ledgerFile),
    base
      ? showFile(project.root, base.commit, toPosix(path.relative(project.gitRoot!, project.ledgerFile)))
      : undefined,
  ]);
  const now = toLedger(result);
  const debt = totalCost(now.findings);
  const ledgerUpToDate = stored === serializeLedger(now);
  const before = baseContent === undefined ? undefined : parseLedger(baseContent);
  const rulesChanged = before !== undefined && !sameRules(before, now);

  const { changed, deleted, cheats } = await readChanges(project, base, result.scannedFiles);
  const configChanged = cheats.some((cheat) => cheat.code === 'CONFIG_CHANGED');
  const hidden = (file: string): boolean => configChanged || cheats.some((cheat) => cheat.file === file);

  const changes = before ? compareLedgers(before, now, deleted) : NO_CHANGES;
  const paid = changes.paid.filter((finding) => !hidden(finding.file));
  const suppressed = changes.paid.filter((finding) => hidden(finding.file));
  const findingsById = new Map(result.findings.map((finding) => [finding.id, finding]));
  const created = changes.created.map((finding) => fromFinding(findingsById.get(finding.id)!)).sort(byPriority);

  const judged = judgeCheats(cheats, suppressed, rulesChanged);
  const { sinceBase, failures: growth } = growthSince(base, before !== undefined && !rulesChanged, changes, paid);
  const failures = [
    ...ledgerFailures(toPosix(path.relative(project.root, project.ledgerFile)), stored, ledgerUpToDate),
    ...judged.failures,
    ...growth,
    ...(options.maxDebt !== undefined && debt > options.maxDebt
      ? [`The debt (${debt} TDC) is above the limit of ${options.maxDebt} TDC`]
      : []),
  ];

  const nowIds = new Set(now.findings.map((finding) => finding.id));
  const paidIds = new Set(changes.paid.map((finding) => finding.id));
  const deletedIds = new Set(changes.deleted.map((finding) => finding.id));
  const ruleDebt = new Map([...(before?.findings ?? []), ...now.findings].map((finding) => [finding.id, finding]));
  const ruleStatus = (id: string, file: string): CheckStatus => {
    if (nowIds.has(id)) return 'present';
    if (deletedIds.has(id)) return 'deleted';
    if (paidIds.has(id)) return hidden(file) ? 'suppressed' : 'paid';
    return 'moved';
  };
  const targets = ids.length
    ? resolveIds(ids, [...ruleDebt.keys(), ...declared.map((item) => item.id)])
    : [
        ...[...changes.paid, ...changes.deleted].map((finding) => finding.id),
        ...touchedDeclared(
          declared.filter((item) => item.status === 'confirmed'),
          changed
        ),
      ];
  const checked = await checkTargets(targets, {
    project,
    asked: ids.length > 0,
    declared,
    ruleDebt,
    ruleStatus,
    hidden,
  });
  const results = checked.results;

  // the debt asked for must be paid; the debt the changes only touched is listed
  const unpaid = ids.length ? results.filter((item) => ['present', 'suppressed', 'unclear'].includes(item.status)) : [];
  failures.push(...unpaid.map((item) => `${item.id} is ${item.status} (${item.file})`));

  const passed = failures.length === 0;
  const again = ['sf tdc check', ...(options.base ? [`--base ${options.base}`] : []), ...ids.map((id) => `--id ${id}`)];
  return {
    passed,
    debt,
    ledgerUpToDate,
    ...(base ? { base: base.ref } : {}),
    sinceBase,
    results,
    created,
    cheats,
    failures,
    warnings: [...baseWarnings(base, before, rulesChanged), ...judged.warnings, ...checked.warnings],
    nextSteps: passed
      ? ['Commit the changes with .tdc/ledger.json and .tdc/debts']
      : nextStepsAfterFailure({ cheats, sinceBase, created, unpaid, ledgerUpToDate, again: again.join(' ') }),
  };
};
