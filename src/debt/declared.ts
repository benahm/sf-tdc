import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { SfError } from '@salesforce/core';

import { TDC_DIR, type Project } from '../project/project.js';
import type { Severity } from '../scan/code-analyzer.js';

export const DEBTS_DIR = 'debts';

export const EXPOSURES = ['anonymous', 'user', 'admin'] as const;
export const IMPACTS = ['data-leak', 'data-corruption', 'limits', 'performance', 'maintainability'] as const;
export const SCOPES = ['record', 'bulk'] as const;
export const CATEGORIES = ['Security', 'Performance', 'ErrorProne', 'BestPractices', 'Design'] as const;

/** Facts about the debt, rather than a level: two runs of an agent agree on facts far more often than on a level. */
export type Criticality = {
  /** Who can trigger the problem. */
  exposure: (typeof EXPOSURES)[number];
  impact: (typeof IMPACTS)[number];
  /** One record, or many at once (a batch, a data load, a bulk API call). */
  scope: (typeof SCOPES)[number];
};

/** A place of the code where the debt is, found again by its snippet: the line can move. */
export type Anchor = { file: string; snippet: string };

/**
 * - `pattern`: a regular expression that matches the file while the debt is there. Deterministic.
 * - `prompt`: a question answered by the agent command of .tdc/config.json, several times. Probabilistic.
 */
export type Verifier = { kind: 'pattern'; file: string; pattern: string } | { kind: 'prompt'; prompt: string };

export type DeclaredStatus = 'confirmed' | 'fixed' | 'rejected';

/** Debt that the rules don't find, declared by an agent or a person, with the way to verify that it is fixed. */
export type DeclaredDebt = {
  id: string;
  source: 'agent' | 'human';
  title: string;
  description: string;
  category: (typeof CATEGORIES)[number];
  criticality: Criticality;
  /** Computed from the criticality. */
  severity: Severity;
  /** Computed from the severity, as for the rules. */
  cost: number;
  anchors: Anchor[];
  verifier: Verifier;
  status: DeclaredStatus;
  /** Verdicts of the verifier on the code when the debt was declared: all of them found the debt. */
  calibration: Verdict[];
  reason?: string;
};

export type Verdict = { verdict: 'present' | 'fixed' | 'unclear'; evidence?: string };

/** What an agent sends to `sf tdc add`: the rest is computed. */
export type DebtInput = Pick<
  DeclaredDebt,
  'title' | 'description' | 'category' | 'criticality' | 'anchors' | 'verifier'
> & { source?: DeclaredDebt['source'] };

const IMPACT_SCORES: Record<Criticality['impact'], number> = {
  'data-leak': 4,
  'data-corruption': 4,
  limits: 3,
  performance: 2,
  maintainability: 1,
};
const LEVELS: Severity[] = ['Info', 'Low', 'Moderate', 'High', 'Critical'];

/** The impact sets the level, an anonymous exposure or a bulk scope raises it, an admin-only exposure lowers it. */
export const severityOf = ({ exposure, impact, scope }: Criticality): Severity => {
  const score =
    IMPACT_SCORES[impact] + (exposure === 'anonymous' ? 1 : exposure === 'admin' ? -1 : 0) + (scope === 'bulk' ? 1 : 0);
  return LEVELS[Math.min(Math.max(score, 1), 5) - 1];
};

/** Trimmed, with its spaces collapsed, as the snippets of the ledger. */
export const normalize = (text: string): string => text.trim().replace(/\s+/g, ' ');

/** The same anchors in the same category are the same debt, whoever declares it and however it is worded. */
export const declaredId = (input: Pick<DebtInput, 'category' | 'anchors'>): string =>
  createHash('sha1')
    .update(
      [input.category, ...input.anchors.map((anchor) => `${anchor.file}\0${normalize(anchor.snippet)}`).sort()].join(
        '\0'
      )
    )
    .digest('hex')
    .slice(0, 12);

/** A refusal an agent can act on: a stable code, and what to do about it. */
export class DebtError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly fix: string
  ) {
    super(message);
  }
}

/** A refusal as the CLI shows it: its code as the name of the error, its fix as the action. */
export const toSfError = (error: unknown): unknown =>
  error instanceof DebtError ? new SfError(error.message, error.code, [error.fix]) : error;

const oneOf = <T extends string>(value: unknown, values: readonly T[], field: string): T => {
  if (typeof value === 'string' && (values as readonly string[]).includes(value)) return value as T;
  throw new DebtError(
    'INVALID_FIELD',
    `${field} is ${JSON.stringify(value)}`,
    `Set ${field} to one of: ${values.join(', ')}`
  );
};

const text = (value: unknown, field: string): string => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  throw new DebtError('INVALID_FIELD', `${field} is missing`, `Set ${field} to a non-empty string`);
};

/** Checks the shape of what an agent sent, field by field, with a fix for each mistake. */
export const parseInput = (value: unknown): DebtInput => {
  if (typeof value !== 'object' || value === null) {
    throw new DebtError(
      'INVALID_JSON',
      'the debt is not a JSON object',
      'Send one JSON object, as `sf tdc guide` shows'
    );
  }
  const input = value as Record<string, unknown>;
  const criticality = (input.criticality ?? {}) as Record<string, unknown>;
  const verifier = (input.verifier ?? {}) as Record<string, unknown>;
  if (!Array.isArray(input.anchors) || input.anchors.length === 0) {
    throw new DebtError(
      'INVALID_FIELD',
      'anchors is missing',
      'Give at least one anchor: { "file": ..., "snippet": ... }'
    );
  }
  const kind = oneOf(verifier.kind, ['pattern', 'prompt'] as const, 'verifier.kind');
  return {
    source: input.source === undefined ? 'agent' : oneOf(input.source, ['agent', 'human'] as const, 'source'),
    title: text(input.title, 'title'),
    description: text(input.description, 'description'),
    category: oneOf(input.category, CATEGORIES, 'category'),
    criticality: {
      exposure: oneOf(criticality.exposure, EXPOSURES, 'criticality.exposure'),
      impact: oneOf(criticality.impact, IMPACTS, 'criticality.impact'),
      scope: oneOf(criticality.scope, SCOPES, 'criticality.scope'),
    },
    anchors: (input.anchors as Array<Record<string, unknown>>).map((anchor, index) => ({
      file: text(anchor?.file, `anchors[${index}].file`).replace(/\\/g, '/'),
      snippet: text(anchor?.snippet, `anchors[${index}].snippet`),
    })),
    verifier:
      kind === 'pattern'
        ? {
            kind,
            file: text(verifier.file, 'verifier.file').replace(/\\/g, '/'),
            pattern: text(verifier.pattern, 'verifier.pattern'),
          }
        : { kind, prompt: text(verifier.prompt, 'verifier.prompt') },
  };
};

const debtsDir = (project: Project): string => path.join(project.root, TDC_DIR, DEBTS_DIR);

export const readDeclaredDebts = async (project: Project): Promise<DeclaredDebt[]> => {
  const dir = debtsDir(project);
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir)).filter((file) => file.endsWith('.json')).sort();
  return Promise.all(
    files.map(async (file) => JSON.parse(await readFile(path.join(dir, file), 'utf8')) as DeclaredDebt)
  );
};

/** One file per debt: two branches only conflict when they change the same debt. */
export const writeDeclaredDebt = async (project: Project, debt: DeclaredDebt): Promise<string> => {
  const file = path.join(debtsDir(project), `${debt.id}.json`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(debt, null, 2)}\n`);
  return file;
};

/** Line (1-based) of the snippet in the content, its spaces collapsed, or undefined when it is not there. */
export const locate = (content: string, snippet: string): number | undefined => {
  // the content as one normalized line, with the offset where each source line starts: the snippet can span lines
  let flat = '';
  const starts: Array<{ offset: number; line: number }> = [];
  content.split(/\r?\n/).forEach((source, index) => {
    const line = normalize(source);
    if (!line) return;
    if (flat) flat += ' ';
    starts.push({ offset: flat.length, line: index + 1 });
    flat += line;
  });
  const at = flat.indexOf(normalize(snippet));
  if (at < 0) return undefined;
  return starts.filter((start) => start.offset <= at).at(-1)?.line ?? 1;
};
