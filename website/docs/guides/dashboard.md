---
title: Debt dashboard
---

Open a visual overview of the debt, explore findings, and inspect repayments commit by commit:

```bash
sf tdc dashboard
```

The report opens in your default browser. It is a standalone HTML file, works offline, and makes no external requests. It is stored in the system temporary directory; the command prints its path if the browser cannot open.

## Export a report

```bash
sf tdc dashboard --output ./reports/debt.html
```

With `--output`, no browser opens. The report can be kept as a CI artifact. Reports include source snippets, file paths and commit information: use the same sharing permissions as the source project. Generated reports should not be committed alongside the ledger.

## Data sources

The dashboard reads `.tdc/ledger.json` on disk and the ledger's Git history. The balance on disk may differ from the last committed balance; the history chart only shows committed ledgers. Run a scan first to include your latest code changes:

```bash
sf tdc scan
sf tdc dashboard
```

Generating or opening a report never runs analyzers or prompt verifiers, updates the ledger, or modifies declared debts. Analyzer findings show the rule and snippet stored in the ledger; current messages and line numbers are not stored in it.

## Views

The dashboard reads like a bank statement for the technical debt.

- **Statement of account**: the balance due in TDC, in workdays and at your daily rate; the debt of the ledger on disk that is not committed yet; the date the debt is repaid at the committed pace, with a stamp (*On track*, *Behind*, *Overdue*, *Repaying*, *Accruing* or *Paid in full*).
- **Overview**: credits (repaid), debits (new debt), net change and coins collected over a selected period; the repayment trajectory; *collection notices* for the files that owe the most; *bounties* for the most expensive debts, worth as many coins once repaid; the progress toward the configured objective, with milestones.
- **Debts**: search by file, problem, rule or ID; filter by source and engine; inspect snippets and copy a verification command. Declared debt has a separate total and remains outside the ledger and coin calculations.
- **Collectors**: the authors ranked by the TDC they earned, with a podium and the progress of each collector toward the next rank. Authors appear by name only, without email. With `game.leaderboard` set to `team` in the [configuration](./configuration.md), the view shows the team total and the report holds no author name.
- **Statement**: each committed ledger as a statement line with its debit, credit, running balance and coins. Baselines and rule changes appear as revaluations and score no coins.

When the latest committed ledger repaid more debt than it created, a few coins rain on the page. Animations are disabled when the system asks for reduced motion.

Rule, cost and engine changes interrupt the chart and start a new measurement baseline. They do not count as repayments or additions. The committed trend uses only the latest baseline and needs at least two commits. File deletions lower debt but remain separate from corrected findings. All costs and projections are estimates.

The report supports light and dark themes, keyboard navigation, and narrow screens. It is a snapshot: run `sf tdc scan` after changing the code, then regenerate the report. Regenerate it after committing a new ledger to update its history.
