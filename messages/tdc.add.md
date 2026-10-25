# summary

Declare debt that the rules don't find, with the way to verify that it is fixed.

# description

Reads a debt as JSON, from the standard input or --file: what the problem is, where it is (anchors: a file and a snippet copied from it), facts about its criticality, and a verifier. "sf tdc guide" shows the format.

The debt is refused when a field is wrong, when a snippet is not in its file, or when the same debt is already declared. Then its verifier runs on the current code, and must find the debt: a verifier that answers "fixed" to anything would prove nothing. A pattern verifier runs once; a prompt verifier runs the agent command of .tdc/config.json several times, and every answer must be "present".

The severity is computed from the criticality, and the cost from the severity, as for the rules. The debt is written to .tdc/debts/<id>.json: commit it.

# flags.file.summary

JSON file of the debt, instead of the standard input.

# info.added

📌 Debt %s declared (%s, %s TDC): commit %s.

# examples

- Declare a debt from a file:

  <%= config.bin %> <%= command.id %> --file debt.json

- From an agent, on the standard input:

  cat debt.json | <%= config.bin %> <%= command.id %> --json
