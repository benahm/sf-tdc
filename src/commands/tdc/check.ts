import { Messages } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';

import { toSfError } from '../../debt/declared.js';
import { checkChanges, type Check, type CheckStatus } from '../../debt/work.js';
import { loadProject } from '../../project/project.js';
import { formatTdc, signed } from '../../report/format.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('sf-tdc', 'tdc.check');

export type TdcCheckResult = Check;

const STATUS_ICONS: Record<CheckStatus, string> = {
  paid: '✅',
  moved: '➡️',
  deleted: '🗑️',
  present: '❌',
  suppressed: '🚫',
  unclear: '❓',
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
    id: Flags.string({
      char: 'i',
      summary: messages.getMessage('flags.id.summary'),
      multiple: true,
    }),
    'max-debt': Flags.integer({
      summary: messages.getMessage('flags.max-debt.summary'),
    }),
    'update-debts': Flags.boolean({
      summary: messages.getMessage('flags.update-debts.summary'),
    }),
  };

  public async run(): Promise<TdcCheckResult> {
    const { flags } = await this.parse(TdcCheck);
    const project = await loadProject(process.cwd());
    let check: Check;
    try {
      check = await checkChanges(project, {
        base: flags.base,
        ids: flags.id,
        maxDebt: flags['max-debt'],
        updateDebts: flags['update-debts'],
      });
    } catch (error) {
      throw toSfError(error);
    }

    for (const warning of check.warnings) this.warn(warning);
    for (const item of check.results) {
      this.log(`${STATUS_ICONS[item.status]} ${item.id} ${item.status} (${item.file})`);
    }
    for (const item of check.created) {
      this.log(
        messages.getMessage('info.created', [item.id, item.rule, item.line ? `${item.file}:${item.line}` : item.file])
      );
    }
    if (check.sinceBase) {
      const { paid, deleted, created } = check.sinceBase;
      this.log(messages.getMessage('info.sinceBase', [check.base, formatTdc(paid + deleted), signed(created)]));
    }

    if (check.passed) {
      this.log(messages.getMessage('info.passed', [formatTdc(check.debt)]));
    } else {
      this.log(messages.getMessage('info.failed'));
      for (const failure of check.failures) this.logToStderr(`  - ${failure}`);
      this.log(messages.getMessage('info.nextSteps'));
      for (const step of check.nextSteps) this.log(`  - ${step}`);
      process.exitCode = 1;
    }
    return check;
  }
}
