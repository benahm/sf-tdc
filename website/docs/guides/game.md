---
title: The game
---

TDC stands for **Technical Debt Coin**: the debt is counted in TDC, and paying it back earns the same TDC, plus ranks.
Everything comes from the history of the [ledger](./ledger.md): nothing to set up besides committing it.

## Earning TDC

The author of a commit earns the TDC of the debt it paid, and loses the TDC of the debt it created. A commit that
removes a query from a loop (15 TDC) and adds a `System.debug` (5 TDC) earns 10 TDC.

The **Collectors** view of the [dashboard](./dashboard.md) ranks the authors by the TDC they earned, with a podium
and the progress of each collector toward the next rank.

Teams that prefer not to rank people set `game.leaderboard` to `team` in
[`.tdc/config.json`](./configuration.md): the dashboard then shows the total of the team, and the report holds no
author name.

## Ranks

| Rank | TDC earned |
| --- | ---: |
| Intern | below 500 |
| Collector | 500 |
| Bailiff | 1,500 |
| Debt Collector | 5,000 |
| Legendary Collector | 15,000 |

## The boss

`sf tdc scan` names the most indebted file of the project the **boss**: its debt is its hit points. Beat it as a team.

## Payoff date and goal

`sf tdc history` shows the debt commit by commit, and forecasts when it reaches 0 at the pace of the history:

```text
$ sf tdc history
┌────────────┬─────────┬────────┬──────┬─────┬──────────┬────────┐
│ Date       │ Commit  │ Author │ Paid │ New │ Earned   │ Debt   │
├────────────┼─────────┼────────┼──────┼─────┼──────────┼────────┤
│ 2026-09-01 │ 1a2b3c4 │ Alice  │      │     │ baseline │ 52,400 │
│ 2026-09-03 │ 5d6e7f8 │ Bob    │ -240 │     │ +240     │ 52,160 │
│ 2026-09-04 │ 9a8b7c6 │ Carol  │ -30  │ +62 │ -32      │ 52,192 │
└────────────┴─────────┴────────┴──────┴─────┴──────────┴────────┘
💰 Debt: 52,192 TDC (≈ 124.3 man-days · 74,560 EUR)
📈 At this pace (69.3 TDC/day), the debt is paid off on 2028-11-10.
🎯 Goal 20,000 TDC by 2027-03-31: ░░░░░░░░░░░░░░░░░░░░ 1% · projected 40,896 TDC: speed up!
```

Set the goal with `sf tdc init --goal-debt 20000 --goal-date 2027-03-31`, or in
[the configuration](./configuration.md).
