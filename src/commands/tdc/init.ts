import { existsSync } from 'node:fs';
import path from 'node:path';

import { Messages } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';

import { DEFAULT_CONFIG, loadProject, toPosix, writeConfig, type TdcConfig } from '../../project/project.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('sf-tdc', 'tdc.init');

export type TdcInitResult = {
  configFile: string;
  config: TdcConfig;
};

export default class TdcInit extends SfCommand<TdcInitResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'daily-rate': Flags.integer({
      summary: messages.getMessage('flags.daily-rate.summary'),
      default: DEFAULT_CONFIG.dailyRate,
      min: 0,
    }),
    currency: Flags.string({
      summary: messages.getMessage('flags.currency.summary'),
      default: DEFAULT_CONFIG.currency,
    }),
    'goal-debt': Flags.integer({
      summary: messages.getMessage('flags.goal-debt.summary'),
    }),
    'goal-date': Flags.string({
      summary: messages.getMessage('flags.goal-date.summary'),
    }),
    force: Flags.boolean({
      summary: messages.getMessage('flags.force.summary'),
    }),
  };

  public async run(): Promise<TdcInitResult> {
    const { flags } = await this.parse(TdcInit);
    const project = await loadProject(process.cwd());
    const configFile = toPosix(path.relative(project.root, project.configFile));
    if (existsSync(project.configFile) && !flags.force) throw messages.createError('error.exists', [configFile]);
    if ((flags['goal-debt'] === undefined) !== (flags['goal-date'] === undefined)) {
      throw messages.createError('error.goal');
    }
    const goalDate = flags['goal-date'];
    if (goalDate !== undefined && (!/^\d{4}-\d{2}-\d{2}$/.test(goalDate) || Number.isNaN(Date.parse(goalDate)))) {
      throw messages.createError('error.goalDate', [goalDate]);
    }

    const config: TdcConfig = {
      ...DEFAULT_CONFIG,
      dailyRate: flags['daily-rate'],
      currency: flags.currency,
      ...(flags['goal-debt'] !== undefined && goalDate ? { goal: { debt: flags['goal-debt'], date: goalDate } } : {}),
    };
    await writeConfig(project.configFile, config);
    this.log(messages.getMessage('info.created', [configFile]));
    return { configFile, config };
  }
}
