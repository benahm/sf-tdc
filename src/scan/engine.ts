import { createHash } from 'node:crypto';

import type { LedgerFinding, Ledger } from '../ledger/ledger.js';
import { listSourceFiles } from '../project/files.js';
import type { Project } from '../project/project.js';
import { RULES } from '../rules/registry.js';
import { createContext, type RuleCategory, type ScanContext } from '../rules/rule.js';

export type Finding = LedgerFinding & {
  category: RuleCategory;
  line?: number;
  message: string;
};

export type ScanResult = {
  findings: Finding[];
  /** Cost of each enabled rule. */
  rules: Record<string, number>;
  linesOfCode: number;
};

const SNIPPET_LENGTH = 160;
const CODE_FILE = /\.(cls|trigger|js|html|cmp|page|component)$/;

const sha = (text: string): string => createHash('sha1').update(text).digest('hex').slice(0, 12);

const countLinesOfCode = async (context: ScanContext): Promise<number> => {
  const counts = await Promise.all(
    context.files
      .filter((file) => CODE_FILE.test(file.relPath))
      .map(async (file) => (await context.read(file)).split('\n').filter((line) => line.trim()).length)
  );
  return counts.reduce((sum, count) => sum + count, 0);
};

export const enabledRules = (project: Project): Array<{ rule: (typeof RULES)[number]; cost: number }> =>
  RULES.filter((rule) => project.config.rules[rule.id]?.enabled !== false).map((rule) => ({
    rule,
    cost: project.config.rules[rule.id]?.cost ?? rule.cost,
  }));

export const scan = async (project: Project): Promise<ScanResult> => {
  const files = await listSourceFiles(project.root, project.sourceDirs);
  const context = createContext(files, project.minApiVersion);
  const rules: Record<string, number> = {};
  const findings: Finding[] = [];

  const enabled = enabledRules(project);
  const results = await Promise.all(enabled.map(({ rule }) => rule.check(context)));
  enabled.forEach(({ rule, cost }, index) => {
    rules[rule.id] = cost;
    const raw = results[index].sort(
      (a, b) => a.file.relPath.localeCompare(b.file.relPath) || (a.line ?? 0) - (b.line ?? 0)
    );
    const ranks = new Map<string, number>();
    for (const item of raw) {
      const snippet = item.snippet.slice(0, SNIPPET_LENGTH);
      const hash = sha(`${rule.id}\0${snippet}`);
      const key = `${item.file.relPath}\0${hash}`;
      const rank = ranks.get(key) ?? 0;
      ranks.set(key, rank + 1);
      findings.push({
        id: sha(`${key}\0${rank}`),
        rule: rule.id,
        category: rule.category,
        file: item.file.relPath,
        line: item.line,
        cost,
        hash,
        snippet,
        message: item.message,
      });
    }
  });

  return { findings, rules, linesOfCode: await countLinesOfCode(context) };
};

export const toLedger = (result: ScanResult): Ledger => ({
  version: 1,
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
