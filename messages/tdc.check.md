# summary

Check the debt in continuous integration: the ledger is up to date, and the debt doesn't grow.

# description

Scans the project and fails (exit code 1) when:

- .tdc/ledger.json is missing or doesn't match the scan: whoever pays debt without updating the ledger would give their TDC to the next commit;
- with --base, the debt grew since the ledger of that ref, typically the target branch of a pull request: paying more than you create passes;
- with --max-debt, the debt is above the limit.

Debt found again in another file (a rename, a refactoring) neither grows nor shrinks the debt. When the rules or their costs changed since --base, the growth check is skipped.

# flags.base.summary

Git ref to compare the debt with, such as the target branch of the pull request.

# flags.max-debt.summary

Highest debt allowed, in TDC.

# error.base

Cannot read the ledger at %s: %s

# failure.noLedger

%s is missing: run sf tdc scan and commit it.

# failure.stale

%s is out of date: run sf tdc scan and commit it.

# failure.grew

The debt grew by %s TDC since %s: %s TDC created, %s TDC paid.

# failure.maxDebt

The debt (%s) is above the limit of %s.

# info.passed

✅ Debt check passed: %s.

# info.failed

❌ Debt check failed.

# info.sinceBase

Since %s: paid %s, new debt %s TDC.

# warning.noBaseLedger

%s has no ledger: nothing to compare with.

# warning.rulesChanged

The rules or their costs changed since %s: the growth of the debt is not checked.

# examples

- Check that the ledger is up to date:

  <%= config.bin %> <%= command.id %>

- In a pull request to main, also check that the debt doesn't grow:

  <%= config.bin %> <%= command.id %> --base origin/main
