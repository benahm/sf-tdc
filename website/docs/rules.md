---
title: Rules
---

The debt is found by the rules of
[Salesforce Code Analyzer](https://developer.salesforce.com/docs/platform/salesforce-code-analyzer/overview), the
static analyzer of Salesforce. The rules read the source of the project: no org is needed.

| Engine | Finds | Needs |
| --- | --- | --- |
| `pmd` | Apex and Visualforce: operations in loops, CRUD and sharing violations, empty catch blocks, hardcoded IDs... | Java 11+ |
| `cpd` | Copy-pasted code. | Java 11+ |
| `flow` | Flows: database operations in loops, record-triggered flows without entry criteria... | Python 3.10+ |
| `eslint` | Lightning Web Components and Aura JavaScript. | |
| `regex` | Old API versions, `Limits.getHeapSize` in loops... | |

sf-tdc embeds these engines with pinned versions, so that every developer and the CI find the same debt in the same
code: the `sf code-analyzer` plugin itself is not needed. `sf code-analyzer rules` lists the rules and their
severities.

## Cost

The `Recommended` rules are selected by default (`ruleSelectors` in [the configuration](./guides/configuration.md)).
A finding costs the TDC of its rule's severity, the minutes it takes to fix it:

| Severity | TDC |
| --- | ---: |
| 1 Critical | 60 |
| 2 High | 30 |
| 3 Moderate | 15 |
| 4 Low | 5 |
| 5 Info | 2 |

A rule is named `engine:rule`, for example `pmd:OperationWithLimitsInLoop`:

```apex
for (Id invoiceId : invoiceIds) {
    Invoice__c invoice = [SELECT Id FROM Invoice__c WHERE Id = :invoiceId]; // pmd:OperationWithLimitsInLoop: 15 TDC
    update invoice;                                                        // pmd:OperationWithLimitsInLoop: 15 TDC
}
```

Reprice a severity with `severityCosts`, disable or reprice a rule with `rules`. The `code-analyzer.yml` of the
project applies too: a rule whose severity it overrides costs the TDC of its new severity, and its ignored files and
suppressions are not debt.

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

- A new version of sf-tdc can embed new versions of the engines, which can find other violations in the same code:
  the commit that upgrades it re-baselines the debt, see [the ledger](./guides/ledger.md#who-paid-what).
- An engine that cannot run (no Java, no Python) fails the scan: a partial scan would pay all the debt of that engine.
- Suppressing a violation (`// NOPMD`, `code-analyzer-suppress`) makes its debt disappear: review suppressions in pull
  requests.
