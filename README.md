# Technical Debt Collector (`sf tdc`)

> **Beta.** Please [report issues](https://github.com/benahm/sf-tdc/issues).

A [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli) plugin that **prices the technical debt** of
a Salesforce project, **tracks in git who pays it back**, and turns it into a game: ranks, badges and a
leaderboard.

The debt is counted in **TDC, Technical Debt Coins**: 1 TDC is a minute of work to fix a finding. Paying 30 TDC of
debt earns you 30 TDC. It is also given in man-days and in money,
with your daily rate.

```text
💰 Technical debt: 48,320 TDC (≈ 115.0 man-days · 69,029 EUR) · rating C
Since the last ledger: paid 1,240 TDC 🎉 · new debt +90 TDC
👹 Boss: force-app/main/default/classes/InvoiceService.cls (4,210 HP)
```

## Install

```bash
sf plugins install sf-tdc@beta
```

## How it works

1. `sf tdc init` creates `.tdc/config.json`; `sf tdc scan` finds the debt and writes `.tdc/ledger.json`.
   **Commit both.**
2. Every developer runs `sf tdc scan` before committing. The ledger holds one finding per line, without line numbers:
   a pull request shows the debt it pays as removed lines and the debt it adds as added lines.
3. Comparing the ledger of each commit with its parent tells who paid what: the author of a commit earns the TDC of
   the debt that disappeared, and loses the TDC of the debt that appeared.

Fair play:

- Debt found again in another file (a rename, a refactoring) is **moved**: neither paid nor created.
- Deleting a whole file is not a payment, unless `game.rewardDeletedFiles` is `true`.
- The first ledger is the **baseline**, and a commit that changes the rules or their costs **re-baselines** the debt:
  nobody wins or loses TDC.
- Merge commits are skipped: the commits of the merged branch already count. With a squash merge, the author of the
  pull request gets the TDC.
- In CI, `sf tdc check` fails when the ledger is out of date, so that nobody gets the TDC of someone else.
- Authors are told apart by their email: map the emails of a same person in a `.mailmap`.

## Commands

| Command | |
| --- | --- |
| `sf tdc init` | Creates `.tdc/config.json`: `--daily-rate`, `--currency`, `--goal-debt` and `--goal-date`. |
| `sf tdc scan` | Finds and prices the debt, writes the ledger. `--dry-run`, `--details` (every finding with its line), `--report-file report.md`, `-d` to scan other folders. |
| `sf tdc history` | The debt commit by commit, and when it will be paid off at this pace. `--since`, `--limit`. |
| `sf tdc leaderboard` | Developers ranked by the TDC they earned. `--me` or `--author` for a card (rank, badges, latest payments), `--team` for the team total without names, `--since` for a sprint. |
| `sf tdc check` | CI gate: fails when the ledger is out of date, when the debt grew since `--base <ref>`, or when it is above `--max-debt`. |

Every command supports `--json`; its format is pinned by [`schemas/`](schemas).

### In a pull request

```bash
sf tdc check --base origin/main
```

## Rules

| Rule | TDC | |
| --- | ---: | --- |
| `apex-soql-in-loop` | 30 | SOQL or SOSL query inside a loop |
| `apex-dml-in-loop` | 30 | DML inside a loop |
| `apex-hardcoded-id` | 15 | Hardcoded record ID |
| `apex-empty-catch` | 10 | Empty catch block (a comment inside counts as a justification) |
| `apex-system-debug` | 2 | `System.debug` left in the code |
| `apex-todo-comment` | 5 | TODO, FIXME, HACK or XXX comment |
| `apex-multiple-triggers` | 60 | Every trigger of an object but the first |
| `apex-see-all-data` | 20 | Test with `SeeAllData=true` |
| `apex-test-without-assert` | 15 | Test method without assertion |
| `apex-class-without-test` | 60 | Class that neither a test class nor a trigger mentions |
| `flow-process-builder` | 240 | Process Builder, to migrate to a flow |
| `automation-workflow-rule` | 120 | Workflow rule, to migrate to a flow |
| `flow-missing-fault-path` | 15 | Flow element that can fail without a fault path |
| `ui-aura-component` | 480 | Aura component, to rewrite as LWC |
| `ui-visualforce-page` | 240 | Visualforce page |
| `metadata-old-api-version` | 10 | API version 9 or more versions behind `sourceApiVersion` (3 years) |
| `metadata-field-without-description` | 5 | Custom field without a description |

Disable or reprice a rule in `.tdc/config.json`:

```json
{
  "dailyRate": 600,
  "currency": "EUR",
  "hoursPerDay": 7,
  "rules": {
    "apex-system-debug": { "enabled": false },
    "ui-aura-component": { "cost": 960 }
  },
  "goal": { "debt": 20000, "date": "2027-03-31" },
  "game": { "rewardDeletedFiles": false }
}
```

The rating (A to E) divides the debt by the cost of writing the code (30 minutes a line), as SonarQube does.

## The game

| Rank | TDC earned |
| --- | ---: |
| Intern | 0 |
| Collector | 500 |
| Bailiff | 1,500 |
| Debt Collector | 5,000 |
| Legendary Collector | 15,000 |

Badges: 🪙 First Payment · 🎯 SOQL Slayer · 🧲 DML Tamer · 🏛️ API Archaeologist · ⚔️ Process Builder Slayer ·
👻 Aura Exorcist · 🛡️ Test Guardian · 💰 Big Payer (1,000 TDC in a commit) · 🔥 Clean Streak (5 commits in a row
paying debt without creating any).
