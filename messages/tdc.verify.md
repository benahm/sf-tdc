# summary

Verify that the changes since the last commit paid the debt, created none, and hid none.

# description

Scans the project and compares it with the ledger of HEAD. Each debt given with --id, or without --id every debt that the changes touched, is:

- paid: gone, and nothing hid it;
- present: still there;
- moved: found again in another file, neither paid nor created;
- deleted: gone with its file, which is not a payment;
- suppressed: gone, but a suppression (NOPMD, @SuppressWarnings, eslint-disable) or a change of .forceignore, code-analyzer.yml, sfdx-project.json or .tdc/config.json hid it;
- unclear: the prompt verifier of a declared debt did not give the same answer every time.

A declared debt is verified by its own verifier, and marked fixed in .tdc/debts when it is paid.

The command fails (exit code 1) when a debt is present, suppressed or unclear, when debt was created, or when debt was hidden. The nextSteps of --json tell an agent what to do next.

# flags.id.summary

Id of the debt to verify, or a unique prefix of it. Can be repeated. Defaults to every debt that the changes touched.

# info.created

➕ %s created: %s at %s

# info.cheat

🚫 %s: %s

# info.passed

✅ Verified: the debt is paid, and nothing was created or hidden.

# info.failed

❌ Not verified:

# examples

- Verify the fix of one debt:

  <%= config.bin %> <%= command.id %> --id 3f9a2c

- Verify everything the changes touched, for an agent:

  <%= config.bin %> <%= command.id %> --json
