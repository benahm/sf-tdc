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

- **Overview**: measured debt, estimated workdays and amount, repayments and additions over a selected period, highest-balance files, next corrections and the configured objective.
- **Debts**: search by file, problem, rule or ID; filter by source and engine; inspect snippets and copy a verification command. Declared debt has a separate total and remains outside the ledger and coin calculations.
- **Activity**: inspect each commit's repaid and introduced findings, moved findings and debt removed with whole files.

Rule, cost and engine changes interrupt the chart and start a new measurement baseline. They do not count as repayments or additions. The committed trend uses only the latest baseline and needs at least two commits. File deletions lower debt but remain separate from corrected findings. All costs and projections are estimates.

The report supports light and dark themes, keyboard navigation, and narrow screens. It is a snapshot: run `sf tdc scan` after changing the code, then regenerate the report. Regenerate it after committing a new ledger to update its history.
