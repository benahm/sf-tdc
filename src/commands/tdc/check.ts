import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { Messages } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';

import { compareLedgers, parseLedger, sameRules, serializeLedger, totalCost } from '../../ledger/ledger.js';
import { git, showFile } from '../../project/git.js';
import { loadProject, toPosix } from '../../project/project.js';
import { formatTdc, signed } from '../../report/format.js';
import { scan, toLedger } from '../../scan/engine.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('sf-tdc', 'tdc.check');

export type TdcCheckResult = {
  passed: boolean;
  debt: number;
  ledgerUpToDate: boolean;
  /** Changes since --base, in TDC. */
  sinceBase?: { base: string; paid: number; created: number };
  failures: string[];
};

export default class TdcCheck extends SfCommand<TdcCheckResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    base: Flags.string({
      char: 'b',
      summary: messages.getMessage('flags.base.summary'),
    }),
    'max-debt': Flags.integer({
      summary: messages.getMessage('flags.max-debt.summary'),
    }),
  };

  public async run(): Promise<TdcCheckResult> {
    const { flags } = await this.parse(TdcCheck);
    const project = await loadProject(process.cwd());
    const ledgerFile = toPosix(path.relative(project.root, project.ledgerFile));
    const ledger = toLedger(await scan(project));
    const debt = totalCost(ledger.findings);
    const failures: string[] = [];

    let stored: string | undefined;
    try {
      stored = (await readFile(project.ledgerFile, 'utf8')).replace(/\r\n/g, '\n');
    } catch {
      failures.push(messages.getMessage('failure.noLedger', [ledgerFile]));
    }
    const ledgerUpToDate = stored === serializeLedger(ledger);
    if (stored !== undefined && !ledgerUpToDate) failures.push(messages.getMessage('failure.stale', [ledgerFile]));

    let sinceBase: TdcCheckResult['sinceBase'];
    if (flags.base) {
      const base = flags.base;
      const repoRoot = project.gitRoot ?? project.root;
      try {
        await git(repoRoot, ['rev-parse', '--verify', `${base}^{commit}`]);
      } catch (error) {
        throw messages.createError('error.base', [base, (error as Error).message.trim()]);
      }
      const baseContent = await showFile(repoRoot, base, toPosix(path.relative(repoRoot, project.ledgerFile)));
      if (baseContent === undefined) {
        this.warn(messages.getMessage('warning.noBaseLedger', [base]));
      } else if (!sameRules(parseLedger(baseContent), ledger)) {
        this.warn(messages.getMessage('warning.rulesChanged', [base]));
      } else {
        const changes = compareLedgers(parseLedger(baseContent), ledger);
        sinceBase = {
          base,
          paid: totalCost(changes.paid) + totalCost(changes.deleted),
          created: totalCost(changes.created),
        };
        this.log(messages.getMessage('info.sinceBase', [base, formatTdc(sinceBase.paid), signed(sinceBase.created)]));
        const growth = sinceBase.created - sinceBase.paid;
        if (growth > 0) {
          failures.push(messages.getMessage('failure.grew', [growth, base, sinceBase.created, sinceBase.paid]));
        }
      }
    }

    const maxDebt = flags['max-debt'];
    if (maxDebt !== undefined && debt > maxDebt) {
      failures.push(messages.getMessage('failure.maxDebt', [formatTdc(debt), formatTdc(maxDebt)]));
    }

    const passed = failures.length === 0;
    if (passed) {
      this.log(messages.getMessage('info.passed', [formatTdc(debt)]));
    } else {
      this.log(messages.getMessage('info.failed'));
      for (const failure of failures) this.logToStderr(`  - ${failure}`);
      process.exitCode = 1;
    }
    return { passed, debt, ledgerUpToDate, sinceBase, failures };
  }
}
