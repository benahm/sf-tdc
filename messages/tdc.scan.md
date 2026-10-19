# summary

Find the technical debt of the project and price it in TDC.

# description

Runs the rules on the source folders (the packageDirectories of sfdx-project.json by default, minus the files excluded by .forceignore) and prices every finding in TDC, Technical Debt Coins: 1 TDC is a minute of work to fix it. The total is also given in man-days and in money, with the daily rate of .tdc/config.json.

The findings are written to .tdc/ledger.json, one per line and without line numbers, so that editing code around a debt changes nothing. Commit the ledger with your changes: comparing it from commit to commit tells who paid the debt ("sf tdc history", "sf tdc leaderboard").

# flags.source-dir.summary

Folder to scan instead of the packageDirectories of sfdx-project.json. Can be repeated.

# flags.dry-run.summary

Show the report without writing the ledger.

# flags.report-file.summary

Also write the report as Markdown to this file.

# flags.details.summary

List every finding with its file and line.

# info.debt

💰 Technical debt: %s (%s) · rating %s

# info.sinceLedger

Since the last ledger: paid %s%s · new debt %s TDC

# info.boss

👹 Boss: %s (%s HP)

# info.noDebt

🏆 No debt found. Spotless!

# info.ledgerWritten

Ledger written to %s: commit it with your changes.

# info.ledgerUnchanged

Ledger %s is up to date.

# info.dryRun

Dry run: %s was not written.

# info.reportWritten

Report written to %s.

# examples

- Scan the project and update the ledger:

  <%= config.bin %> <%= command.id %>

- Show every finding without writing the ledger:

  <%= config.bin %> <%= command.id %> --dry-run --details

- Write a Markdown report, for example for a pull request comment:

  <%= config.bin %> <%= command.id %> --report-file tdc-report.md
