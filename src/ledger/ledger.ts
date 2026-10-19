import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

/** A piece of debt as the ledger stores it: no line number, so that editing code around it changes nothing. */
export type LedgerFinding = {
  /** Unique in the ledger: file, rule, snippet and rank among the identical findings of the file. */
  id: string;
  rule: string;
  file: string;
  cost: number;
  /** Rule and snippet, without the file: the same debt moved to another file keeps it. */
  hash: string;
  snippet: string;
};

export type Ledger = {
  version: 1;
  /** Cost of each enabled rule when the ledger was written: a change re-baselines the debt instead of scoring it. */
  rules: Record<string, number>;
  findings: LedgerFinding[];
};

export const EMPTY_LEDGER: Ledger = { version: 1, rules: {}, findings: [] };

export const totalCost = (findings: Array<{ cost: number }>): number =>
  findings.reduce((sum, finding) => sum + finding.cost, 0);

/**
 * One finding per line, sorted: a pull request shows the debt it pays or adds as removed or added lines, and two
 * branches only conflict when they change the same findings.
 */
export const serializeLedger = (ledger: Ledger): string => {
  const rules = Object.keys(ledger.rules)
    .sort()
    .map((rule) => `    ${JSON.stringify(rule)}: ${ledger.rules[rule]}`);
  const findings = [...ledger.findings]
    .sort((a, b) => a.file.localeCompare(b.file) || a.rule.localeCompare(b.rule) || a.id.localeCompare(b.id))
    .map(({ id, rule, file, cost, hash, snippet }) => `    ${JSON.stringify({ id, rule, file, cost, hash, snippet })}`);
  const block = (lines: string[], open: string, close: string): string =>
    lines.length ? `${open}\n${lines.join(',\n')}\n  ${close}` : `${open}${close}`;
  return `{\n  "version": 1,\n  "rules": ${block(rules, '{', '}')},\n  "findings": ${block(findings, '[', ']')}\n}\n`;
};

export const parseLedger = (content: string): Ledger => {
  const ledger = JSON.parse(content) as Partial<Ledger>;
  return { version: 1, rules: ledger.rules ?? {}, findings: ledger.findings ?? [] };
};

export const readLedger = async (file: string): Promise<Ledger | undefined> => {
  try {
    return parseLedger(await readFile(file, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
};

export const writeLedger = async (file: string, ledger: Ledger): Promise<void> => {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, serializeLedger(ledger));
};

export const sameRules = (a: Ledger, b: Ledger): boolean => {
  const keys = Object.keys(a.rules);
  return keys.length === Object.keys(b.rules).length && keys.every((rule) => a.rules[rule] === b.rules[rule]);
};

export type LedgerChanges = {
  /** Debt that disappeared while its file still exists. */
  paid: LedgerFinding[];
  /** Debt that disappeared with its file. */
  deleted: LedgerFinding[];
  created: LedgerFinding[];
  /** Debt found again in another file (rename, refactoring): neither paid nor created. */
  moved: number;
};

/**
 * What changed between two ledgers. `deletedFiles` holds the files deleted in between, with paths relative to the
 * project root.
 */
export const compareLedgers = (before: Ledger, after: Ledger, deletedFiles = new Set<string>()): LedgerChanges => {
  const afterIds = new Set(after.findings.map((finding) => finding.id));
  const beforeIds = new Set(before.findings.map((finding) => finding.id));
  const added = after.findings.filter((finding) => !beforeIds.has(finding.id));
  const addedByHash = new Map<string, LedgerFinding[]>();
  for (const finding of added) addedByHash.set(finding.hash, [...(addedByHash.get(finding.hash) ?? []), finding]);

  const changes: LedgerChanges = { paid: [], deleted: [], created: [], moved: 0 };
  const movedIds = new Set<string>();
  for (const finding of before.findings) {
    if (afterIds.has(finding.id)) continue;
    const target = addedByHash.get(finding.hash)?.shift();
    if (target) {
      movedIds.add(target.id);
      changes.moved++;
    } else if (deletedFiles.has(finding.file)) {
      changes.deleted.push(finding);
    } else {
      changes.paid.push(finding);
    }
  }
  changes.created = added.filter((finding) => !movedIds.has(finding.id));
  return changes;
};
