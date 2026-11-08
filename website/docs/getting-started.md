---
title: Getting started
---

## Install

```bash
sf plugins install sf-tdc@beta
```

The rules of [Salesforce Code Analyzer](./rules.md) need **Java 11+** and **Python 3.10+**.

The plugin is not signed by Salesforce, so `sf` asks you to confirm the installation. In CI, add `sf-tdc` to
`~/.config/sf/unsignedPluginAllowList.json` to skip the question. Update with `sf plugins update`.

## Set up the project

From the root of a Salesforce project (the folder of `sfdx-project.json`), in a git repository:

```bash
sf tdc init --daily-rate 600 --currency EUR
sf tdc scan
```

`init` creates `.tdc/config.json`, `scan` finds the debt and writes `.tdc/ledger.json`. Commit both:

```bash
git add .tdc
git commit -m "chore: start collecting the technical debt"
```

This first ledger is the **baseline**: its debt was not created by this commit, nobody loses TDC for it.

## Pay some debt

Fix a finding, for example a query inside a loop. `sf tdc next` lists the debt, most expensive first, with its file and
line:

```bash
sf tdc next --limit 10
```

Then scan again and commit the ledger with the fix:

```text
$ sf tdc scan
💰 Technical debt: 48,305 TDC (≈ 115.0 man-days · 69,007 EUR) · rating C
Since the last ledger: paid 30 TDC 🎉 · new debt 0 TDC
Ledger written to .tdc/ledger.json: commit it with your changes.
```

The commit earns you the 15 TDC you paid: open the dashboard to see it in the **Collectors** view.

```bash
sf tdc dashboard
```

## Next steps

- Run [`sf tdc check`](./commands/tdc-check.md) in CI so that the ledger stays up to date: see [CI setup](./guides/ci.md).
- Set a goal and a payoff date: see [Configuration](./guides/configuration.md).
- Learn how scores are computed: see [The ledger](./guides/ledger.md) and [The game](./guides/game.md).
