import { totalCost } from '../ledger/ledger.js';

import type { DashboardData, DashboardFinding } from './data.js';

type Total = { cost: number; count: number };
type MeasuredRow = [id: string, rule: number, file: number, snippet: number, cost: number, line?: number];
type Rule = Pick<DashboardFinding, 'rule' | 'problem' | 'category' | 'severity' | 'url'>;
type Bounty = Pick<DashboardFinding, 'id' | 'file' | 'snippet' | 'cost' | 'line'> & { rule: number };
type Payload = {
  overview: Omit<DashboardData, 'findings' | 'declared'> & {
    rules: Rule[];
    count: number;
    measuredCount: number;
    affectedFiles: number;
    topRules: Array<[string, Total]>;
    declaredDebt: number;
    files: Array<[string, Total]>;
    categories: Array<[string, Total]>;
    big: Bounty[];
    quick: Bounty[];
  };
  details: { rows: MeasuredRow[]; paths: string[]; snippets: string[]; declared: DashboardFinding[] };
};

const add = (totals: Map<string, Total>, key: string, cost: number): void => {
  const total = totals.get(key) ?? { cost: 0, count: 0 };
  total.cost += cost;
  total.count++;
  totals.set(key, total);
};

const byTotal = (totals: Map<string, Total>): Array<[string, Total]> =>
  [...totals].sort(([a, left], [b, right]) => right.cost - left.cost || a.localeCompare(b, 'en'));

const pick = (
  sorted: DashboardFinding[],
  keyOf: (finding: DashboardFinding) => string,
  skip = new Set<string>()
): DashboardFinding[] => {
  const selected: DashboardFinding[] = [];
  const seen = new Set<string>();
  for (const finding of sorted) {
    const key = keyOf(finding);
    if (seen.has(key) || skip.has(finding.id)) continue;
    seen.add(key);
    selected.push(finding);
    if (selected.length === 4) break;
  }
  return selected;
};

/** An offline report has a small overview and a separate block the explorer parses on demand. */
export const dashboardPayload = ({ findings, declared, ...data }: DashboardData): Payload => {
  const paths = new Map<string, number>();
  const snippets = new Map<string, number>();
  const ruleIds = new Map<string, number>();
  const rules: Rule[] = [];
  const files = new Map<string, Total>();
  const categories = new Map<string, Total>();
  const ruleTotals = new Map<string, Total>();
  const index = (dictionary: Map<string, number>, value: string): number => {
    const existing = dictionary.get(value);
    if (existing !== undefined) return existing;
    const next = dictionary.size;
    dictionary.set(value, next);
    return next;
  };

  const rows = findings.map((finding): MeasuredRow => {
    const { id, rule, file, snippet, cost, line, problem, category, severity, url } = finding;
    const ruleIndex = index(ruleIds, rule);
    if (ruleIndex === rules.length) rules.push({ rule, problem, category, severity, url });
    add(files, file, cost);
    add(ruleTotals, rule, cost);
    add(categories, category?.length ? category : rule.split(':')[0], cost);
    const row: MeasuredRow = [id, ruleIndex, index(paths, file), index(snippets, snippet), cost];
    if (line !== undefined) row.push(line);
    return row;
  });

  const compareLocation = (a: DashboardFinding, b: DashboardFinding): number =>
    a.file.localeCompare(b.file, 'en') || a.id.localeCompare(b.id, 'en');
  const big = pick(
    [...findings].sort((a, b) => b.cost - a.cost || compareLocation(a, b)),
    (finding) => finding.file
  );
  const quick = pick(
    [...findings].sort((a, b) => a.cost - b.cost || compareLocation(a, b)),
    (finding) => finding.rule,
    new Set(big.map((finding) => finding.id))
  );
  const bounty = ({ id, rule, file, snippet, cost, line }: DashboardFinding): Bounty => ({
    id,
    rule: ruleIds.get(rule)!,
    file,
    snippet,
    cost,
    line,
  });

  return {
    overview: {
      ...data,
      rules,
      count: rows.length + declared.length,
      measuredCount: rows.length,
      affectedFiles: files.size,
      topRules: byTotal(ruleTotals).slice(0, 3),
      declaredDebt: totalCost(declared),
      files: byTotal(files).slice(0, 5),
      categories: byTotal(categories),
      big: big.map(bounty),
      quick: quick.map(bounty),
    },
    details: { rows, paths: [...paths.keys()], snippets: [...snippets.keys()], declared },
  };
};
