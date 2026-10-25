import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { LedgerFinding, Ledger } from '../ledger/ledger.js';
import { listSourceFiles, type SourceFile } from '../project/files.js';
import { toPosix, type Project } from '../project/project.js';
import { runCodeAnalyzer, type Analyzer, type AnalyzerRule } from './code-analyzer.js';

export type Finding = LedgerFinding & {
  category: string;
  line?: number;
  message: string;
};

export type RuleInfo = { category: string; summary: string };

export type ScanResult = {
  findings: Finding[];
  /** Cost of each enabled rule. */
  rules: Record<string, number>;
  /** Category and description of each enabled rule. */
  catalog: Record<string, RuleInfo>;
  engines: Record<string, string>;
  linesOfCode: number;
};

/** The analyzer of the scans: the tests replace it, code-analyzer takes seconds to start. */
export const analyzer: { run: Analyzer } = { run: runCodeAnalyzer };

const SNIPPET_LENGTH = 160;
const CODE_FILE = /\.(cls|trigger|js|html|cmp|page|component)$/;
/** Tags of code-analyzer rules that tell what the rule is about, in order of precedence. */
const CATEGORIES = ['Security', 'Performance', 'ErrorProne', 'BestPractices', 'Design', 'CodeStyle', 'Documentation'];

const sha = (text: string): string => createHash('sha1').update(text).digest('hex').slice(0, 12);

const categoryOf = (rule: AnalyzerRule): string => CATEGORIES.find((tag) => rule.tags.includes(tag)) ?? 'Other';

export const enabledRules = (project: Project, rules: AnalyzerRule[]): Array<{ rule: AnalyzerRule; cost: number }> =>
  rules
    .filter((rule) => project.config.rules[rule.id]?.enabled !== false)
    .map((rule) => ({
      rule,
      cost: project.config.rules[rule.id]?.cost ?? project.config.severityCosts[rule.severity],
    }));

const countLinesOfCode = async (files: SourceFile[], linesOf: (file: string) => Promise<string[]>): Promise<number> => {
  const counts = await Promise.all(
    files
      .filter((file) => CODE_FILE.test(file.relPath))
      .map(async (file) => (await linesOf(file.path)).filter((line) => line.trim()).length)
  );
  return counts.reduce((sum, count) => sum + count, 0);
};

export const scan = async (project: Project): Promise<ScanResult> => {
  const files = await listSourceFiles(project.root, project.sourceDirs);
  const contents = new Map<string, Promise<string[]>>();
  const linesOf = (file: string): Promise<string[]> => {
    let lines = contents.get(file);
    if (!lines) {
      lines = readFile(file, 'utf8').then((content) => content.split(/\r?\n/));
      contents.set(file, lines);
    }
    return lines;
  };

  const analysis = await analyzer.run(project, files);
  const enabled = new Map(enabledRules(project, analysis.rules).map((item) => [item.rule.id, item]));
  const rules: Record<string, number> = {};
  const catalog: Record<string, RuleInfo> = {};
  for (const [id, { rule, cost }] of enabled) {
    rules[id] = cost;
    catalog[id] = { category: categoryOf(rule), summary: rule.description };
  }

  const violations = analysis.violations
    .filter((violation) => enabled.has(violation.rule))
    .map((violation) => ({ ...violation, relPath: toPosix(path.relative(project.root, violation.file)) }))
    .sort(
      (a, b) =>
        a.rule.localeCompare(b.rule) ||
        a.relPath.localeCompare(b.relPath) ||
        (a.line ?? 0) - (b.line ?? 0) ||
        (a.column ?? 0) - (b.column ?? 0) ||
        a.message.localeCompare(b.message)
    );
  const ranks = new Map<string, number>();
  const findings: Finding[] = [];
  for (const violation of violations) {
    // the source line, trimmed with its spaces collapsed: editing code around the debt doesn't change it
    // eslint-disable-next-line no-await-in-loop
    const lines = await linesOf(violation.file);
    const line = violation.line ? (lines[violation.line - 1] ?? '') : '';
    const snippet = line.trim().replace(/\s+/g, ' ').slice(0, SNIPPET_LENGTH);
    const hash = sha(`${violation.rule}\0${snippet}`);
    const key = `${violation.relPath}\0${hash}`;
    const rank = ranks.get(key) ?? 0;
    ranks.set(key, rank + 1);
    const { rule, cost } = enabled.get(violation.rule)!;
    findings.push({
      id: sha(`${key}\0${rank}`),
      rule: rule.id,
      category: catalog[rule.id].category,
      file: violation.relPath,
      line: violation.line,
      cost,
      hash,
      snippet,
      message: violation.message,
    });
  }

  return { findings, rules, catalog, engines: analysis.engines, linesOfCode: await countLinesOfCode(files, linesOf) };
};

export const toLedger = (result: ScanResult): Ledger => ({
  version: 2,
  engines: result.engines,
  rules: result.rules,
  findings: result.findings.map(({ id, rule, file, cost, hash, snippet }) => ({
    id,
    rule,
    file,
    cost,
    hash,
    snippet,
  })),
});
