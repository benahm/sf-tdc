---
title: What is the Technical Debt Collector?
sidebar_label: Introduction
slug: /
---

The Technical Debt Collector (`sf tdc`) is a [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli)
plugin that **puts a price on the technical debt** of a Salesforce project, **tracks in git who pays it back**, and
turns paying it back into a game.

```text
$ sf tdc scan
💰 Technical debt: 48,320 TDC (≈ 115.0 man-days · 69,029 EUR) · rating C
Since the last ledger: paid 1,240 TDC 🎉 · new debt +90 TDC
👹 Boss: force-app/main/default/classes/InvoiceService.cls (4,210 HP)
```

## The TDC

The debt is counted in **TDC, Technical Debt Coins**: **1 TDC is a minute of work** to fix a finding. A query inside
a loop costs 30 TDC, a Process Builder to migrate to a flow 240 TDC, an Aura component to rewrite as LWC 480 TDC. The
total is also given in man-days and in money, with your daily rate.

The TDC are also what you earn: a commit that pays 30 TDC of debt earns its author 30 TDC.

## Why

Technical debt is invisible until it costs a sprint. Static analysis tools list hundreds of warnings that nobody
reads. The Technical Debt Collector answers three questions instead:

- **How much do we owe?** One number, in time and in money, that a project manager understands.
- **Is it getting better?** The history of the debt, commit by commit, and the date it will be paid off at this pace.
- **Who is paying it back?** Every commit that fixes debt earns its TDC to its author. Ranks, badges and a leaderboard
  make it visible, and fun.

## What is inside

| Command | What it does |
| --- | --- |
| [`sf tdc init`](./commands/tdc-init.md) | Sets up the project: daily rate, rules, goal. |
| [`sf tdc scan`](./commands/tdc-scan.md) | Finds and prices the debt, writes the ledger to commit. |
| [`sf tdc history`](./commands/tdc-history.md) | The debt commit by commit, and the forecast payoff date. |
| [`sf tdc leaderboard`](./commands/tdc-leaderboard.md) | Developers ranked by the TDC they earned: ranks, badges. |
| [`sf tdc check`](./commands/tdc-check.md) | CI gate: the ledger is up to date, and the debt doesn't grow. |

## Principles

- **Nothing outside git.** No server, no database: the [ledger](./guides/ledger.md) is a file of the repository, and
  the scores are computed from its history.
- **Fair play.** Moving code is neither paying nor creating debt; the first ledger and rule changes don't score.
- **Offline.** The rules of [Salesforce Code Analyzer](./rules.md) read the source of the project: no org is needed.
