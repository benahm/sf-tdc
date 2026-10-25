# summary

Show how an AI agent works with sf-tdc: the workflows, the rules, and the format of a declared debt.

# description

Everything an agent needs before fixing or declaring debt, in one answer: the commands to run in order, what it must never do (suppressions, changes of configuration), the format of "sf tdc add" with an example, the criticality grid and the costs of the project.

The guide ships with the plugin, so that it never drifts from the commands: an agent instruction can just say "run sf tdc guide --json and follow it".

# examples

- Read the guide:

  <%= config.bin %> <%= command.id %>

- Give it to an agent:

  <%= config.bin %> <%= command.id %> --json
