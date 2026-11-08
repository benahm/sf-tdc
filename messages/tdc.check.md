# summary

Check the changes: the ledger is up to date, the debt doesn't grow, nothing hides debt, and the debt you fixed is paid.

# description

Scans the project and compares it with the ledger of --base (HEAD by default, or where the branch forked from it). It fails (exit code 1) when:

- .tdc/ledger.json is missing or doesn't match the scan: whoever pays debt without updating the ledger would give their TDC to the next commit;
- the debt grew since --base: paying more than you create passes, and debt found again in another file (a rename, a refactoring) neither grows nor shrinks it;
- a suppression (NOPMD, @SuppressWarnings, eslint-disable) was added, or debt disappeared while .forceignore, code-analyzer.yml, sfdx-project.json or .tdc/config.json changed;
- a debt given with --id is not paid;
- with --max-debt, the debt is above the limit.

When the rules, their costs or the engines changed since --base, the debt is re-baselined and its growth is not checked.

Each debt given with --id, or without --id each debt that the changes paid or touched, is listed as:

- paid: gone, and nothing hid it;
- present: still there;
- moved: found again in another file, neither paid nor created;
- deleted: gone with its file, which is not a payment;
- suppressed: gone, but a suppression or a change of configuration hid it;
- unclear: the prompt verifier of a declared debt did not give the same answer every time.

A declared debt is checked by its own verifier, and marked fixed in .tdc/debts when it is paid. The nextSteps of --json tell an agent what to do next.

# flags.base.summary

Git ref to compare with, such as the target branch of the pull request. Defaults to HEAD.

# flags.id.summary

Id of a debt that must be paid, or a unique prefix of it. Can be repeated.

# flags.max-debt.summary

Highest debt allowed, in TDC.

# info.created

➕ %s created: %s at %s

# info.sinceBase

Since %s: paid %s, new debt %s TDC.

# info.passed

✅ Debt check passed: %s.

# info.failed

❌ Debt check failed:

# info.nextSteps

Next steps:

# examples

- Check the changes since the last commit, after sf tdc scan:

  <%= config.bin %> <%= command.id %>

- Check that a fix paid its debt, for an agent:

  <%= config.bin %> <%= command.id %> --id 3f9a2c --json

- In a pull request to main:

  <%= config.bin %> <%= command.id %> --base origin/main
