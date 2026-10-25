import { Messages } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';

import { workQueue, type WorkItem } from '../../debt/work.js';
import { loadProject } from '../../project/project.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('sf-tdc', 'tdc.next');

export type TdcNextResult = {
  items: WorkItem[];
  /** Debt matching the filters, the items included. */
  total: number;
  remaining: number;
};

export default class TdcNext extends SfCommand<TdcNextResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    limit: Flags.integer({
      char: 'n',
      summary: messages.getMessage('flags.limit.summary'),
      default: 5,
      min: 1,
    }),
    file: Flags.string({
      char: 'f',
      summary: messages.getMessage('flags.file.summary'),
    }),
    rule: Flags.string({
      char: 'r',
      summary: messages.getMessage('flags.rule.summary'),
    }),
    source: Flags.option({
      summary: messages.getMessage('flags.source.summary'),
      options: ['code-analyzer', 'agent', 'human'] as const,
    })(),
  };

  public async run(): Promise<TdcNextResult> {
    const { flags } = await this.parse(TdcNext);
    const project = await loadProject(process.cwd());
    const matching = (await workQueue(project)).filter(
      (item) =>
        (!flags.file || item.file.includes(flags.file.replace(/\\/g, '/'))) &&
        (!flags.rule || item.rule.toLowerCase().includes(flags.rule.toLowerCase())) &&
        (!flags.source || item.source === flags.source)
    );
    const items = matching.slice(0, flags.limit);

    if (items.length === 0) {
      this.log(messages.getMessage('info.none'));
    } else {
      this.table({
        data: items.map((item) => ({
          id: item.id,
          cost: item.cost,
          rule: item.rule,
          location: item.line ? `${item.file}:${item.line}` : item.file,
          problem: item.problem,
        })),
        columns: [
          { key: 'id', name: 'Id' },
          { key: 'cost', name: 'TDC' },
          { key: 'rule', name: 'Rule' },
          { key: 'location', name: 'File' },
          { key: 'problem', name: 'Problem' },
        ],
      });
      this.log(messages.getMessage('info.remaining', [matching.length - items.length]));
    }
    return { items, total: matching.length, remaining: matching.length - items.length };
  }
}
