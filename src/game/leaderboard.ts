import type { CommitEvent } from '../ledger/history.js';
import { totalCost } from '../ledger/ledger.js';

export type Rank = { name: string; minCoins: number };

export const RANKS: Rank[] = [
  { name: 'Intern', minCoins: Number.NEGATIVE_INFINITY },
  { name: 'Collector', minCoins: 500 },
  { name: 'Bailiff', minCoins: 1500 },
  { name: 'Debt Collector', minCoins: 5000 },
  { name: 'Legendary Collector', minCoins: 15_000 },
];

export type Player = {
  author: string;
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
};

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
      const coins = authorEvents.reduce((sum, event) => sum + event.coins, 0);
      return {
        author: latest.author,
        coins,
        paid: totalCost(authorEvents.flatMap((event) => event.paid)),
        created: totalCost(authorEvents.flatMap((event) => event.created)),
        deleted: totalCost(authorEvents.flatMap((event) => event.deleted)),
        commits: authorEvents.filter((event) => event.paid.length + event.created.length + event.deleted.length > 0)
          .length,
        ...rankOf(coins),
      };
    })
    .sort((a, b) => b.coins - a.coins || a.author.localeCompare(b.author));
};

/** Every player summed into one, for teams that keep names out of the game. */
export const teamOf = (players: Player[], name: string): Player => {
  const sum = (key: 'coins' | 'paid' | 'created' | 'deleted' | 'commits'): number =>
    players.reduce((total, player) => total + player[key], 0);
  const coins = sum('coins');
  return {
    author: name,
    coins,
    paid: sum('paid'),
    created: sum('created'),
    deleted: sum('deleted'),
    commits: sum('commits'),
    ...rankOf(coins),
  };
};
