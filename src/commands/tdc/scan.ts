import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { Messages } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';

import { readLedger, serializeLedger, writeLedger } from '../../ledger/ledger.js';
import { loadProject } from '../../project/project.js';
import { formatNumber, formatPrice, formatTdc, signed } from '../../report/format.js';
import { scan, toLedger } from '../../scan/engine.js';
import { buildReport, toMarkdown, type ScanReport } from '../../scan/report.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('sf-tdc', 'tdc.scan');

export type TdcScanResult = ScanReport;

const readText = async (file: string): Promise<string | undefined> => {
  try {
    return await readFile(file, 'utf8');
  } catch {
    return undefined;
  }
};

export default class TdcScan extends SfCommand<TdcScanResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'source-dir': Flags.directory({
      char: 'd',
      summary: messages.getMessage('flags.source-dir.summary'),
      multiple: true,
    }),
    'dry-run': Flags.boolean({
      summary: messages.getMessage('flags.dry-run.summary'),
    }),
    'report-file': Flags.file({
      char: 'r',
      summary: messages.getMessage('flags.report-file.summary'),
    }),
    details: Flags.boolean({
      summary: messages.getMessage('flags.details.summary'),
    }),
  };

  public async run(): Promise<TdcScanResult> {
    const { flags } = await this.parse(TdcScan);
    const project = await loadProject(process.cwd(), flags['source-dir']);
    const previous = await readLedger(project.ledgerFile);
    const result = await scan(project);
    const ledger = toLedger(result);
    const changed = (await readText(project.ledgerFile))?.replace(/\r\n/g, '\n') !== serializeLedger(ledger);
    if (!flags['dry-run'] && changed) await writeLedger(project.ledgerFile, ledger);
    const report = buildReport(project, result, previous, !flags['dry-run'] && changed);

    this.print(report, flags.details);
    if (flags['dry-run']) {
      this.log(messages.getMessage('info.dryRun', [report.ledgerFile]));
    } else {
      this.log(messages.getMessage(changed ? 'info.ledgerWritten' : 'info.ledgerUnchanged', [report.ledgerFile]));
    }
    if (flags['report-file']) {
      await writeFile(path.resolve(flags['report-file']), toMarkdown(report));
      this.log(messages.getMessage('info.reportWritten', [flags['report-file']]));
    }
    return report;
  }

  private print(report: ScanReport, details: boolean): void {
    if (report.debt === 0) {
      this.log(messages.getMessage('info.noDebt'));
      return;
    }
    this.log(messages.getMessage('info.debt', [formatTdc(report.debt), formatPrice(report.price), report.rating]));
    if (report.sinceLedger) {
      const { paid, created } = report.sinceLedger;
      this.log(messages.getMessage('info.sinceLedger', [formatTdc(paid), paid > 0 ? ' 🎉' : '', signed(created)]));
    }
    this.log();
    this.table({
      data: report.byRule.map((rule) => ({
        rule: rule.rule,
        category: rule.category,
        count: rule.count,
        cost: formatNumber(rule.cost),
      })),
      columns: [
        { key: 'rule', name: 'Rule' },
        { key: 'category', name: 'Category' },
        { key: 'count', name: 'Findings' },
        { key: 'cost', name: 'TDC' },
      ],
    });
    const boss = report.topFiles[0];
    this.log(messages.getMessage('info.boss', [boss.file, formatNumber(boss.cost)]));
    if (details) {
      this.table({
        data: report.findings.map((finding) => ({
          location: finding.line ? `${finding.file}:${finding.line}` : finding.file,
          rule: finding.rule,
          cost: finding.cost,
          message: finding.message,
        })),
        columns: [
          { key: 'location', name: 'File' },
          { key: 'rule', name: 'Rule' },
          { key: 'cost', name: 'TDC' },
          { key: 'message', name: 'Finding' },
        ],
      });
    }
  }
}
