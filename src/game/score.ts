import type { CommitEvent } from '../ledger/history.js';
import type { Goal, TdcConfig } from '../project/project.js';

const DAY = 24 * 60 * 60 * 1000;
/** Development cost of a line of code, in minutes: the SQALE convention used by SonarQube. */
const MINUTES_PER_LINE = 30;

export type Price = { manDays: number; amount: number; currency: string };

export const price = (cost: number, config: TdcConfig): Price => {
  const manDays = cost / 60 / config.hoursPerDay;
  return { manDays, amount: manDays * config.dailyRate, currency: config.currency };
};

export type Rating = 'A' | 'B' | 'C' | 'D' | 'E';

/** Debt divided by the cost of writing the code: A up to 5%, B 10%, C 20%, D 50%, E beyond. */
export const debtRatio = (debt: number, linesOfCode: number): number =>
  linesOfCode === 0 ? (debt === 0 ? 0 : 1) : debt / (linesOfCode * MINUTES_PER_LINE);

export const rating = (ratio: number): Rating =>
  ratio <= 0.05 ? 'A' : ratio <= 0.1 ? 'B' : ratio <= 0.2 ? 'C' : ratio <= 0.5 ? 'D' : 'E';

export type Forecast = {
  /** Debt paid per day over the history, negative when the debt grows. */
  paidPerDay: number;
  /** When the debt reaches 0 at this pace. */
  payoffDate?: string;
  goal?: Goal & {
    /** Share of the way from the first debt of the history to the goal. */
    progress: number;
    projectedDebt: number;
    onTrack: boolean;
  };
};

const day = (time: number): string => new Date(time).toISOString().slice(0, 10);

export const forecast = (events: CommitEvent[], goal?: Goal, now = Date.now()): Forecast | undefined => {
  if (events.length === 0) return undefined;
  const first = events[0];
  const last = events[events.length - 1];
  const days = Math.max((Date.parse(last.date) - Date.parse(first.date)) / DAY, 1);
  const paidPerDay = (first.debt - last.debt) / days;
  const result: Forecast = { paidPerDay };
  if (paidPerDay > 0 && last.debt > 0) result.payoffDate = day(now + (last.debt / paidPerDay) * DAY);
  if (goal) {
    const daysLeft = Math.max((Date.parse(goal.date) - now) / DAY, 0);
    const projectedDebt = Math.max(last.debt - paidPerDay * daysLeft, 0);
    const span = first.debt - goal.debt;
    const progress = span <= 0 ? 1 : Math.min(Math.max((first.debt - last.debt) / span, 0), 1);
    result.goal = { ...goal, progress, projectedDebt, onTrack: projectedDebt <= goal.debt };
  }
  return result;
};
