import { existsSync } from 'node:fs';
import path from 'node:path';

import { debtRatio, price, rating, type Price, type Rating } from '../game/score.js';
import { compareLedgers, totalCost, type Ledger } from '../ledger/ledger.js';
import { toPosix, type Project } from '../project/project.js';
import { formatNumber, formatPrice, formatTdc, signed } from '../report/format.js';
import { toLedger, type Finding, type ScanResult } from './engine.js';

export type RuleTotal = {
  rule: string;
  category: string;
  summary: string;
  count: number;
  cost: number;
};

export type FileTotal = { file: string; count: number; cost: number };

export type ScanReport = {
  debt: number;
  price: Price;
  rating: Rating;
  debtRatio: number;
  linesOfCode: number;
  byRule: RuleTotal[];
  /** Most indebted files first: the first one is the boss. */
  topFiles: FileTotal[];
  /** Changes since the ledger found on disk before the scan, in TDC. */
  sinceLedger?: { paid: number; deleted: number; created: number; moved: number };
  ledgerFile: string;
  ledgerWritten: boolean;
  findings: Finding[];
};

const TOP_FILES = 5;

export const buildReport = (
  project: Project,
  result: ScanResult,
  previous: Ledger | undefined,
  ledgerWritten: boolean
): ScanReport => {
  const debt = totalCost(result.findings);
  const ratio = debtRatio(debt, result.linesOfCode);

  const byRule = new Map<string, RuleTotal>();
  const byFile = new Map<string, FileTotal>();
  for (const finding of result.findings) {
    const rule = byRule.get(finding.rule) ?? {
      rule: finding.rule,
      category: finding.category,
      summary: result.catalog[finding.rule]?.summary ?? '',
      count: 0,
      cost: 0,
    };
    rule.count++;
    rule.cost += finding.cost;
    byRule.set(finding.rule, rule);
    const file = byFile.get(finding.file) ?? { file: finding.file, count: 0, cost: 0 };
    file.count++;
    file.cost += finding.cost;
    byFile.set(finding.file, file);
  }

  let sinceLedger: ScanReport['sinceLedger'];
  if (previous) {
    const deletedFiles = new Set(
      previous.findings.map((finding) => finding.file).filter((file) => !existsSync(path.join(project.root, file)))
    );
    const changes = compareLedgers(previous, toLedger(result), deletedFiles);
    sinceLedger = {
      paid: totalCost(changes.paid),
      deleted: totalCost(changes.deleted),
      created: totalCost(changes.created),
      moved: changes.moved,
    };
  }

  return {
    debt,
    price: price(debt, project.config),
    rating: rating(ratio),
    debtRatio: ratio,
    linesOfCode: result.linesOfCode,
    byRule: [...byRule.values()].sort((a, b) => b.cost - a.cost),
    topFiles: [...byFile.values()].sort((a, b) => b.cost - a.cost || a.file.localeCompare(b.file)).slice(0, TOP_FILES),
    sinceLedger,
    ledgerFile: toPosix(path.relative(project.root, project.ledgerFile)),
    ledgerWritten,
    findings: result.findings,
  };
};

export const toMarkdown = (report: ScanReport): string => {
  const lines = [
    '# Technical debt',
    '',
    `**${formatTdc(report.debt)}** (${formatPrice(report.price)}) · rating **${report.rating}** · debt ratio ${formatNumber(report.debtRatio * 100, 1)}%`,
    '',
  ];
  if (report.sinceLedger) {
    lines.push(
      `Since the last ledger: paid **${formatTdc(report.sinceLedger.paid)}**, new debt ${signed(report.sinceLedger.created)} TDC.`,
      ''
    );
  }
  lines.push('## By rule', '', '| Rule | Category | Findings | TDC |', '| --- | --- | ---: | ---: |');
  for (const rule of report.byRule) {
    lines.push(`| ${rule.rule} | ${rule.category} | ${rule.count} | ${formatNumber(rule.cost)} |`);
  }
  lines.push('', '## Most indebted files', '', '| File | Findings | TDC |', '| --- | ---: | ---: |');
  for (const file of report.topFiles) {
    lines.push(`| \`${file.file}\` | ${file.count} | ${formatNumber(file.cost)} |`);
  }
  lines.push('', '## Findings', '', '| File | Line | Rule | TDC | |', '| --- | ---: | --- | ---: | --- |');
  for (const finding of report.findings) {
    lines.push(
      `| \`${finding.file}\` | ${finding.line ?? ''} | ${finding.rule} | ${finding.cost} | ${finding.message.replaceAll('|', '\\|')} |`
    );
  }
  return `${lines.join('\n')}\n`;
};
