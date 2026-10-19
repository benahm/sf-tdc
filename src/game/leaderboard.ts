import { payments, type CommitEvent } from '../ledger/history.js';
import { totalCost } from '../ledger/ledger.js';

export type Rank = { name: string; minCoins: number };

export const RANKS: Rank[] = [
  { name: 'Intern', minCoins: Number.NEGATIVE_INFINITY },
  { name: 'Collector', minCoins: 500 },
  { name: 'Bailiff', minCoins: 1500 },
  { name: 'Debt Collector', minCoins: 5000 },
  { name: 'Legendary Collector', minCoins: 15_000 },
];

export type Badge = { id: string; icon: string; name: string; description: string };

export type Payment = {
  sha: string;
  date: string;
  rule: string;
  file: string;
  cost: number;
  snippet: string;
};

export type Player = {
  author: string;
  email: string;
  coins: number;
  /** TDC paid, created, and removed with deleted files. */
  paid: number;
  created: number;
  deleted: number;
  /** Commits that paid or created debt. */
  commits: number;
  rank: string;
  /** Progress from the current rank to the next one, between 0 and 1. */
  nextRank?: { name: string; coinsToGo: number; progress: number };
  badges: Badge[];
  /** Most recent first. */
  payments: Payment[];
};

type BadgeRule = Badge & {
  earned(events: CommitEvent[], paidByRule: Map<string, number>): boolean;
};

const paidAtLeast =
  (rule: string, count: number) =>
  (_events: CommitEvent[], paidByRule: Map<string, number>): boolean =>
    (paidByRule.get(rule) ?? 0) >= count;

/** `length` scored commits in a row that paid debt and created none. */
const streak =
  (length: number) =>
  (events: CommitEvent[]): boolean => {
    let current = 0;
    for (const event of events) {
      current = event.paid.length > 0 && event.created.length === 0 ? current + 1 : 0;
      if (current >= length) return true;
    }
    return false;
  };

const BADGES: BadgeRule[] = [
  {
    id: 'first-payment',
    icon: '🪙',
    name: 'First Payment',
    description: 'Paid a first piece of debt.',
    earned: (events) => events.some((event) => event.paid.length > 0),
  },
  {
    id: 'soql-slayer',
    icon: '🎯',
    name: 'SOQL Slayer',
    description: 'Took 10 queries out of loops.',
    earned: paidAtLeast('apex-soql-in-loop', 10),
  },
  {
    id: 'dml-tamer',
    icon: '🧲',
    name: 'DML Tamer',
    description: 'Took 10 DML statements out of loops.',
    earned: paidAtLeast('apex-dml-in-loop', 10),
  },
  {
    id: 'api-archaeologist',
    icon: '🏛️',
    name: 'API Archaeologist',
    description: 'Upgraded the API version of 10 components.',
    earned: paidAtLeast('metadata-old-api-version', 10),
  },
  {
    id: 'process-builder-slayer',
    icon: '⚔️',
    name: 'Process Builder Slayer',
    description: 'Migrated a Process Builder.',
    earned: paidAtLeast('flow-process-builder', 1),
  },
  {
    id: 'aura-exorcist',
    icon: '👻',
    name: 'Aura Exorcist',
    description: 'Replaced an Aura component.',
    earned: paidAtLeast('ui-aura-component', 1),
  },
  {
    id: 'test-guardian',
    icon: '🛡️',
    name: 'Test Guardian',
    description: 'Added assertions to 10 tests.',
    earned: paidAtLeast('apex-test-without-assert', 10),
  },
  {
    id: 'big-payer',
    icon: '💰',
    name: 'Big Payer',
    description: 'Paid 1,000 TDC in a single commit.',
    earned: (events) => events.some((event) => totalCost(event.paid) >= 1000),
  },
  {
    id: 'clean-streak',
    icon: '🔥',
    name: 'Clean Streak',
    description: '5 commits in a row paying debt without creating any.',
    earned: streak(5),
  },
];

export const rankOf = (coins: number): Pick<Player, 'rank' | 'nextRank'> => {
  const index = RANKS.findLastIndex((rank) => coins >= rank.minCoins);
  const next = RANKS[index + 1];
  if (!next) return { rank: RANKS[index].name };
  // the first rank has no floor: its progress starts at 0 coins
  const floor = Math.max(RANKS[index].minCoins, 0);
  const progress = Math.max(coins - floor, 0) / (next.minCoins - floor);
  return {
    rank: RANKS[index].name,
    nextRank: { name: next.name, coinsToGo: next.minCoins - coins, progress },
  };
};

/** Players sorted by the TDC they earned. Authors are told apart by email: map aliases with a .mailmap. */
export const buildLeaderboard = (events: CommitEvent[]): Player[] => {
  const byEmail = new Map<string, CommitEvent[]>();
  for (const event of events.filter((item) => item.kind === 'scored')) {
    const key = event.email.toLowerCase();
    byEmail.set(key, [...(byEmail.get(key) ?? []), event]);
  }
  return [...byEmail.values()]
    .map((authorEvents): Player => {
      const latest = authorEvents[authorEvents.length - 1];
      const paidByRule = new Map<string, number>();
      for (const finding of authorEvents.flatMap((event) => event.paid)) {
        paidByRule.set(finding.rule, (paidByRule.get(finding.rule) ?? 0) + 1);
      }
      const coins = authorEvents.reduce((sum, event) => sum + event.coins, 0);
      return {
        author: latest.author,
        email: latest.email,
        coins,
        paid: totalCost(authorEvents.flatMap((event) => event.paid)),
        created: totalCost(authorEvents.flatMap((event) => event.created)),
        deleted: totalCost(authorEvents.flatMap((event) => event.deleted)),
        commits: authorEvents.filter((event) => event.paid.length + event.created.length + event.deleted.length > 0)
          .length,
        ...rankOf(coins),
        badges: BADGES.filter((badge) => badge.earned(authorEvents, paidByRule)).map(
          ({ id, icon, name, description }) => ({ id, icon, name, description })
        ),
        payments: authorEvents
          .flatMap(payments)
          .reverse()
          .map(({ sha, date, rule, file, cost, snippet }) => ({
            sha,
            date,
            rule,
            file,
            cost,
            snippet,
          })),
      };
    })
    .sort((a, b) => b.coins - a.coins || a.author.localeCompare(b.author));
};

export const matchesAuthor = (player: Player, query: string): boolean => {
  const lower = query.toLowerCase();
  return player.email.toLowerCase() === lower || player.author.toLowerCase() === lower;
};
