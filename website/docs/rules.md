---
title: Rules
---

The rules read the source of the project: no org is needed. Each finding costs the TDC of its rule: the minutes it
takes to fix it. Disable or reprice a rule in [the configuration](./guides/configuration.md).

## Apex

| Rule | TDC | Finds |
| --- | ---: | --- |
| `apex-soql-in-loop` | 30 | A SOQL or SOSL query inside a `for`, `while` or `do` loop, inline or with `Database.query`. The query of a SOQL `for` loop runs once and is not a finding. |
| `apex-dml-in-loop` | 30 | An `insert`, `update`, `upsert`, `delete`, `undelete` or `merge` statement, or a `Database` DML method, inside a loop. |
| `apex-hardcoded-id` | 15 | A string that looks like a 15 or 18 character record ID. |
| `apex-empty-catch` | 10 | A `catch` block with nothing inside. A comment explaining why counts as content. |
| `apex-system-debug` | 2 | A `System.debug` call. |
| `apex-todo-comment` | 5 | A comment with `TODO`, `FIXME`, `HACK` or `XXX`. |
| `apex-multiple-triggers` | 60 | Every trigger of an object but the first: their order of execution is not guaranteed. |

Comments and strings are never mistaken for code: `// [SELECT Id FROM Account]` is not a query.

```java
for (Id invoiceId : invoiceIds) {
    Invoice__c invoice = [SELECT Id FROM Invoice__c WHERE Id = :invoiceId]; // apex-soql-in-loop: 30 TDC
    update invoice;                                                        // apex-dml-in-loop: 30 TDC
}
```

## Tests

| Rule | TDC | Finds |
| --- | ---: | --- |
| `apex-see-all-data` | 20 | `SeeAllData=true`: the test depends on the data of the org it runs in. |
| `apex-test-without-assert` | 15 | A test method (`@IsTest` or `testMethod`) without any `assert` or `verify` call. |
| `apex-class-without-test` | 60 | A class that neither a test class nor a trigger mentions. A trigger handler counts as tested: the DML of the tests run it. Exceptions and interfaces are ignored. |

## Automation

| Rule | TDC | Finds |
| --- | ---: | --- |
| `flow-process-builder` | 240 | A Process Builder, retired by Salesforce, to migrate to a record-triggered flow. |
| `automation-workflow-rule` | 120 | Each rule of a workflow, retired by Salesforce, to migrate to a record-triggered flow. |
| `flow-missing-fault-path` | 15 | A create, update, delete, get records or action element of a flow without a fault path. |

## UI

| Rule | TDC | Finds |
| --- | ---: | --- |
| `ui-aura-component` | 480 | An Aura component (`.cmp`), to rewrite as a Lightning Web Component. |
| `ui-visualforce-page` | 240 | A Visualforce page. |

## Metadata

| Rule | TDC | Finds |
| --- | ---: | --- |
| `metadata-old-api-version` | 10 | A component saved with an API version older than `minApiVersion`: by default 9 versions (3 years) behind the `sourceApiVersion` of `sfdx-project.json`. |
| `metadata-field-without-description` | 5 | A custom field of the project without description. Managed package fields are ignored. |

## Rating

The rating divides the debt by the cost of writing the code, 30 minutes a line, as SonarQube does:

| Rating | Debt ratio |
| --- | --- |
| A | up to 5% |
| B | up to 10% |
| C | up to 20% |
| D | up to 50% |
| E | beyond |

## Limits

The Apex rules use a lexer, not a full parser: a query inside a method called from a loop is not found. Report false
positives as [issues](https://github.com/benahm/sf-tdc/issues): a false positive costs TDC to someone who did
nothing wrong.
