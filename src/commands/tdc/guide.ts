import { Messages } from '@salesforce/core';
import { SfCommand } from '@salesforce/sf-plugins-core';

import { buildGuide, guideToMarkdown, type Guide } from '../../debt/guide.js';
import { loadProject } from '../../project/project.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('sf-tdc', 'tdc.guide');

export type TdcGuideResult = Guide;

export default class TdcGuide extends SfCommand<TdcGuideResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public async run(): Promise<TdcGuideResult> {
    await this.parse(TdcGuide);
    const guide = buildGuide(await loadProject(process.cwd()));
    this.log(guideToMarkdown(guide));
    return guide;
  }
}
