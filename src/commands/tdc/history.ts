import path from 'node:path';

import { Messages } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';

import { forecast, price, type Forecast } from '../../game/score.js';
import { readHistory, type CommitKind } from '../../ledger/history.js';
import { totalCost } from '../../ledger/ledger.js';
import { loadProject, toPosix } from '../../project/project.js';
import { bar, formatNumber, formatPrice, formatTdc, shortSha, signed } from '../../report/format.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('sf-tdc', 'tdc.history');

export type HistoryEntry = {
  sha: string;
  author: string;
  email: string;
  date: string;
  subject: string;
  kind: CommitKind;
  /** Debt after the commit, in TDC. */
  debt: number;
  paid: number;
  deleted: number;
  created: number;
  moved: number;
  coins: number;
};

export type TdcHistoryResult = {
  debt: number;
  commits: HistoryEntry[];
  forecast?: Forecast;
};

const KIND_NOTES: Record<CommitKind, string> = {
  baseline: 'baseline',
  'rules-changed': 'rules changed',
  scored: '',
};

export default class TdcHistory extends SfCommand<TdcHistoryResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    since: Flags.string({
      summary: messages.getMessage('flags.since.summary'),
    }),
    limit: Flags.integer({
      summary: messages.getMessage('flags.limit.summary'),
      default: 20,
      min: 1,
    }),
  };

  public async run(): Promise<TdcHistoryResult> {
    const { flags } = await this.parse(TdcHistory);
    const project = await loadProject(process.cwd());
    const events = await readHistory(project, { since: flags.since });
    const commits = events.map(
      (event): HistoryEntry => ({
        sha: event.sha,
        author: event.author,
        email: event.email,
        date: event.date,
        subject: event.subject,
        kind: event.kind,
        debt: event.debt,
        paid: totalCost(event.paid),
        deleted: totalCost(event.deleted),
        created: totalCost(event.created),
        moved: event.moved,
        coins: event.coins,
      })
    );
    if (commits.length === 0) {
      this.log(messages.getMessage('info.empty', [toPosix(path.relative(project.root, project.ledgerFile))]));
      return { debt: 0, commits };
    }

    const debt = commits[commits.length - 1].debt;
    const result: TdcHistoryResult = {
      debt,
      commits,
      forecast: forecast(events, project.config.goal),
    };
    this.table({
      data: commits.slice(-flags.limit).map((commit) => ({
        date: commit.date.slice(0, 10),
        sha: shortSha(commit.sha),
        author: commit.author,
        paid: commit.paid ? `-${formatNumber(commit.paid)}` : '',
        // the debt of a baseline was not created by its commit
        created: commit.created && commit.kind !== 'baseline' ? `+${formatNumber(commit.created)}` : '',
        coins: commit.kind === 'scored' ? signed(commit.coins) : KIND_NOTES[commit.kind],
        debt: formatNumber(commit.debt),
      })),
      columns: [
        { key: 'date', name: 'Date' },
        { key: 'sha', name: 'Commit' },
        { key: 'author', name: 'Author' },
        { key: 'paid', name: 'Paid' },
        { key: 'created', name: 'New' },
        { key: 'coins', name: 'Earned' },
        { key: 'debt', name: 'Debt' },
      ],
    });

    const scored = commits.filter((commit) => commit.kind === 'scored');
    this.log(messages.getMessage('info.debt', [formatTdc(debt), formatPrice(price(debt, project.config))]));
    this.log(
      messages.getMessage('info.paid', [
        commits.length,
        formatTdc(scored.reduce((sum, commit) => sum + commit.paid, 0)),
        signed(scored.reduce((sum, commit) => sum + commit.created, 0)),
      ])
    );
    this.printForecast(result.forecast);
    return result;
  }

  private printForecast(prediction: Forecast | undefined): void {
    if (!prediction) return;
    if (prediction.payoffDate) {
      this.log(messages.getMessage('info.forecast', [formatNumber(prediction.paidPerDay, 1), prediction.payoffDate]));
    } else if (prediction.paidPerDay < 0) {
      this.log(messages.getMessage('info.growing', [formatNumber(-prediction.paidPerDay, 1)]));
    }
    const { goal } = prediction;
    if (goal) {
      this.log(
        messages.getMessage('info.goal', [
          formatTdc(goal.debt),
          goal.date,
          bar(goal.progress),
          goal.onTrack
            ? messages.getMessage('info.onTrack')
            : messages.getMessage('info.offTrack', [formatTdc(Math.round(goal.projectedDebt))]),
        ])
      );
    }
  }
}
