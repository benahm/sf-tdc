# summary

List the next debt to fix, most expensive first: the work queue of a developer or an AI agent.

# description

Scans the project and lists the debt found by the rules and the debt declared with "sf tdc add", in one queue: most expensive first, then by file and line, so that two runs give the same order. Each item tells what the problem is, where it is, and the command that verifies its fix.

Use --json from an agent: the items are all it needs to start fixing.

# flags.limit.summary

Number of items to list.

# flags.file.summary

Only the debt of the files whose path contains this text.

# flags.rule.summary

Only the debt of the rules whose name contains this text, such as "Soql" or "declared:Security".

# flags.source.summary

Only the debt found by the rules (code-analyzer), or declared by an agent or a person.

# info.none

🎉 No debt to fix.

# info.remaining

%s more: raise --limit or narrow with --file and --rule.

# examples

- The 5 most expensive debts:

  <%= config.bin %> <%= command.id %>

- The debt of one class, for an agent:

  <%= config.bin %> <%= command.id %> --file AccountService --json

- The declared debt only:

  <%= config.bin %> <%= command.id %> --source agent
