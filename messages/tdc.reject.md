# summary

Reject a declared debt that is not one: a false positive.

# description

Marks a debt declared with "sf tdc add" as rejected, with the reason, in .tdc/debts. It leaves the queue of "sf tdc next". This is a decision for a person, not for the agent that declared the debt or the one that fixes it.

The debt of the rules is not rejected one by one: disable or reprice its rule in .tdc/config.json.

# flags.id.summary

Id of the declared debt, or a unique prefix of it.

# flags.reason.summary

Why it is not a debt.

# info.rejected

Debt %s rejected: commit %s.

# examples

- Reject a false positive:

  <%= config.bin %> <%= command.id %> --id a41c09 --reason "The flow only runs for admins"
