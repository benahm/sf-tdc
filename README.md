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

📖 **Documentation: <https://benahm.github.io/sf-tdc/>**

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
- The first ledger is the **baseline**, and a commit that changes the rules, their costs or the version of Code
  Analyzer **re-baselines** the debt:
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

### For AI agents

| Command | |
| --- | --- |
| `sf tdc guide` | How an agent works with sf-tdc: the workflows, what it must never do, the format of a declared debt. |
| `sf tdc next` | The work queue: the debt to fix, most expensive first, with its file, line and the command that verifies it. `--limit`, `--file`, `--rule`, `--source`. |
| `sf tdc verify` | Whether the changes since HEAD paid the debt (`--id`), created none, and hid none: a suppression (`NOPMD`, `@SuppressWarnings`...) or a change of `.forceignore` or `code-analyzer.yml` is not a payment. Exit code 1 otherwise, with the next steps. |
| `sf tdc add` | Declares debt that the rules don't find, with a verifier (a pattern, or a prompt) that must find it on the current code. |
| `sf tdc reject` | Sets a declared debt aside: a false positive, for a person to decide. |

An agent instruction can say: *run `sf tdc guide --json` and follow it.*

### In a pull request

```bash
sf tdc check --base origin/main
```

## Rules

The debt is found by the rules of [Salesforce Code Analyzer](https://developer.salesforce.com/docs/platform/salesforce-code-analyzer/overview):
PMD and CPD for Apex and Visualforce, the Flow engine, ESLint for Lightning components, and regex rules. sf-tdc embeds
its engines with pinned versions, so that every developer and the CI find the same debt. It needs **Java 11+** (PMD)
and **Python 3.10+** (Flow); the `sf code-analyzer` plugin itself is not needed.

The `Recommended` rules are selected by default. A finding costs the TDC of its rule's severity:

| Severity | TDC |
| --- | ---: |
| 1 Critical | 60 |
| 2 High | 30 |
| 3 Moderate | 15 |
| 4 Low | 5 |
| 5 Info | 2 |

Select other rules, reprice a severity, or disable or reprice a rule (`engine:rule`) in `.tdc/config.json`:

```json
{
  "dailyRate": 600,
  "currency": "EUR",
  "hoursPerDay": 7,
  "ruleSelectors": ["Recommended"],
  "severityCosts": { "Critical": 60, "High": 30, "Moderate": 15, "Low": 5, "Info": 2 },
  "rules": {
    "pmd:ApexDoc": { "enabled": false },
    "pmd:OperationWithLimitsInLoop": { "cost": 30 }
  },
  "goal": { "debt": 20000, "date": "2027-03-31" },
  "game": { "rewardDeletedFiles": false }
}
```

The `code-analyzer.yml` of the project applies too: its rule overrides, ignored files and suppressions.

The rating (A to E) divides the debt by the cost of writing the code (30 minutes a line), as SonarQube does.

## The game

| Rank | TDC earned |
| --- | ---: |
| Intern | 0 |
| Collector | 500 |
| Bailiff | 1,500 |
| Debt Collector | 5,000 |
| Legendary Collector | 15,000 |

Badges: 🪙 First Payment · 🎯 SOQL Slayer · 🧲 DML Tamer · 🏛️ API Archaeologist · 🔐 Security Guard ·
🛡️ Test Guardian · 💰 Big Payer (1,000 TDC in a commit) · 🔥 Clean Streak (5 commits in a row
paying debt without creating any).
