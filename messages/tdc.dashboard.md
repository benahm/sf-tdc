# summary

Open an offline dashboard of the debt, its history, and the work to do.

# description

Generates a self-contained HTML report and opens it in your default browser. With --output, saves the report to that path without opening a browser, suitable for CI artifacts.

Reads the ledger on disk and its git history without running the analyzers, updating the ledger or running declared-debt verifiers. Run sf tdc scan first to include your latest code changes.

The dashboard reads like a bank statement: the balance due and the date it is repaid at the committed pace, the debt not committed yet, the files that owe the most, bounties for the most expensive debts, the leaderboard of the collectors by period, and each committed ledger as a statement line. It separates measured and declared debt, and marks rule or engine changes as new baselines. Reports contain source snippets and commit information: share them only where the project's code may be shared. Without --output, the report is stored in the system temporary directory.

# flags.output.summary

Save the HTML report to this path without opening a browser.

# info.saved

Dashboard saved to %s

# warning.browser

Could not open a browser. Open this report manually: %s

# examples

- Generate and open the dashboard:

  <%= config.bin %> <%= command.id %>

- Export a standalone report without opening a browser:

  <%= config.bin %> <%= command.id %> --output ./report.html
