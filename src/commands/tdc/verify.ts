import { Messages } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';

import { toSfError } from '../../debt/declared.js';
import { verifyChanges, type Verification } from '../../debt/work.js';
import { loadProject } from '../../project/project.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('sf-tdc', 'tdc.verify');

export type TdcVerifyResult = Verification;

const STATUS_ICONS: Record<string, string> = {
  paid: '✅',
  moved: '➡️',
  deleted: '🗑️',
  present: '❌',
  suppressed: '🚫',
  unclear: '❓',
};

export default class TdcVerify extends SfCommand<TdcVerifyResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    id: Flags.string({
      char: 'i',
      summary: messages.getMessage('flags.id.summary'),
      multiple: true,
    }),
  };

  public async run(): Promise<TdcVerifyResult> {
    const { flags } = await this.parse(TdcVerify);
    const project = await loadProject(process.cwd());
    let verification: Verification;
    try {
      verification = await verifyChanges(project, flags.id);
    } catch (error) {
      throw toSfError(error);
    }

    for (const warning of verification.warnings) this.warn(warning);
    for (const item of verification.results) {
      this.log(`${STATUS_ICONS[item.status]} ${item.id} ${item.status} (${item.file})`);
    }
    for (const item of verification.created) {
      this.log(
        messages.getMessage('info.created', [item.id, item.rule, item.line ? `${item.file}:${item.line}` : item.file])
      );
    }
    for (const cheat of verification.cheats) {
      this.log(
        messages.getMessage('info.cheat', [cheat.code, cheat.line ? `${cheat.file}:${cheat.line}` : cheat.file])
      );
    }
    this.log(messages.getMessage(verification.passed ? 'info.passed' : 'info.failed'));
    for (const step of verification.nextSteps) this.log(`  - ${step}`);
    if (!verification.passed) process.exitCode = 1;
    return verification;
  }
}
