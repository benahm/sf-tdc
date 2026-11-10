import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { Messages } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';

import { browser } from '../../dashboard/browser.js';
import { dashboardData } from '../../dashboard/data.js';
import { renderDashboard } from '../../dashboard/render.js';
import { loadProject } from '../../project/project.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('sf-tdc', 'tdc.dashboard');

export type TdcDashboardResult = { file: string; opened: boolean; debt: number; generatedAt: string };

export default class TdcDashboard extends SfCommand<TdcDashboardResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly flags = {
    output: Flags.file({ summary: messages.getMessage('flags.output.summary') }),
  };

  public async run(): Promise<TdcDashboardResult> {
    const { flags } = await this.parse(TdcDashboard);
    const data = await dashboardData(await loadProject(process.cwd()), (warning) => this.warn(warning));
    const file = flags.output
      ? path.resolve(flags.output)
      : path.join(await mkdtemp(path.join(os.tmpdir(), 'sf-tdc-dashboard-')), 'index.html');
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, renderDashboard(data), 'utf8');
    let opened = false;
    if (!flags.output) {
      try {
        await browser.open(file);
        opened = true;
      } catch {
        this.warn(messages.getMessage('warning.browser', [file]));
      }
    }
    this.log(messages.getMessage('info.saved', [file]));
    return { file, opened, debt: data.debt, generatedAt: data.generatedAt };
  }
}
