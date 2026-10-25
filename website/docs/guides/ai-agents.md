---
title: AI agents
---

An AI coding agent (Claude Code, Codex...) can fix the debt, and find the debt that the rules don't. sf-tdc gives it
a work queue, and **verifies** its work: the agent proposes, deterministic code decides.

Give the agent one instruction: *run `sf tdc guide --json` and follow it.* The guide ships with the plugin: the
workflows, what the agent must never do, the format of a declared debt and the costs of the project.

## Fix debt

```bash
sf tdc next --json                 # the debt to fix, most expensive first
sf tdc verify --id 3f9a2c --json   # exit code 0: paid, nothing created, nothing hidden
sf tdc scan                        # then commit the fix with .tdc/ledger.json
```

[`sf tdc next`](../commands/tdc-next.md) lists each debt with its rule, problem, file, line and the command that
verifies it, in a stable order: two agents asking at the same time get the same work.

[`sf tdc verify`](../commands/tdc-verify.md) compares the code with the ledger of `HEAD`. Each debt is `paid`,
`present`, `moved`, `deleted`, `suppressed` or `unclear`, and the debt the changes created is listed. It fails when
debt is left, created or hidden, and its `nextSteps` tell the agent what to do.

### What is not a payment

An agent takes the shortest path. These make debt disappear without fixing it, and `verify` refuses them:

- a suppression added to the code: `NOPMD`, `@SuppressWarnings`, `eslint-disable`;
- a change of `.forceignore`, `code-analyzer.yml`, `sfdx-project.json`, `.tdc/config.json` or an ESLint configuration;
- deleting the file of the debt (`deleted`: not a failure, not a payment).

## Declare debt

The rules don't see everything: business logic in a trigger, a flow that runs without sharing, a hardcoded id. An
agent can look for it, and declare it with [`sf tdc add`](../commands/tdc-add.md):

```json
{
  "title": "Flow updates accounts in system mode without checking access",
  "description": "Lead_Assign runs without sharing and updates the Account of the lead.",
  "category": "Security",
  "criticality": { "exposure": "user", "impact": "data-corruption", "scope": "record" },
  "anchors": [
    {
      "file": "force-app/main/default/flows/Lead_Assign.flow-meta.xml",
      "snippet": "<runInMode>SystemModeWithoutSharing</runInMode>"
    }
  ],
  "verifier": {
    "kind": "pattern",
    "file": "force-app/main/default/flows/Lead_Assign.flow-meta.xml",
    "pattern": "<runInMode>SystemModeWithoutSharing</runInMode>"
  }
}
```

```bash
sf tdc add --json < debt.json
```

The debt is written to `.tdc/debts/<id>.json`, to commit. It is refused, with a code and a fix, when:

- a field is wrong (`INVALID_FIELD`);
- a snippet is not in its file (`ANCHOR_NOT_FOUND`): only spaces and line breaks can differ, so an agent can't make
  up the code;
- the same debt is declared already (`DUPLICATE`): the id comes from the category and the anchors, not the wording;
- **its verifier doesn't find it on the current code** (`CALIBRATION_FAILED`): a verifier that answers "fixed" to
  anything would prove nothing.

### Criticality

The agent doesn't choose a level: it answers three questions, and the severity is computed. Two runs agree on facts
far more often than on a level.

| Question | Answers |
| --- | --- |
| `exposure`: who can trigger it? | `anonymous`, `user`, `admin` |
| `impact` | `data-leak`, `data-corruption` (High), `limits` (Moderate), `performance` (Low), `maintainability` (Info) |
| `scope` | `record`, `bulk` |

An anonymous exposure or a bulk scope raises the level one step, an admin-only exposure lowers it one step. The cost
is the cost of the severity, as for [the rules](../rules.md).

### Verifiers

| Kind | Present while | Deterministic |
| --- | --- | --- |
| `pattern` | `pattern`, a JavaScript regular expression, matches `file` | yes |
| `prompt` | the agent command answers `present` to `prompt`, every time, quoting code that is in the files | no |

Prefer a pattern: many problems found by an agent come down to one. A prompt verifier needs `verifier.command` in
[the configuration](./configuration.md), a command that reads the prompt on its standard input, such as `claude -p`
or `codex exec -`. It is asked `verifier.runs` times (3 by default): a verdict counts only when all agree, and a
`present` whose evidence is not in the files is `unclear`.

Once declared, the debt is in the queue of `sf tdc next`, and `sf tdc verify` marks it `fixed` when its verifier
finds it gone.

### False positives

A person, not the agent, sets a false positive aside with [`sf tdc reject`](../commands/tdc-reject.md), with a
reason kept in its file. The debt of the rules is not rejected one by one: disable or reprice its rule.

Declared debt stays out of `.tdc/ledger.json` and of [the game](./game.md): no coins depend on the answer of a
model.
