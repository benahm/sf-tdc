---
title: Configuration
---

`.tdc/config.json` is created by [`sf tdc init`](../commands/tdc-init.md). Commit it: the team shares the same rules.

```json
{
  "dailyRate": 600,
  "currency": "EUR",
  "hoursPerDay": 7,
  "ruleSelectors": ["Recommended"],
  "severityCosts": { "Critical": 60, "High": 30, "Moderate": 15, "Low": 5, "Info": 2 },
  "rules": {
    "pmd:ApexDoc": { "enabled": false },
    "pmd:OperationWithLimitsInLoop": { "cost": 30 }
  },
  "goal": { "debt": 20000, "date": "2027-03-31" },
  "game": { "rewardDeletedFiles": false }
}
```

| Key | Default | |
| --- | --- | --- |
| `dailyRate` | `600` | Cost of a day of work, to price the debt. |
| `currency` | `EUR` | Currency of the daily rate. |
| `hoursPerDay` | `7` | Hours in a day of work: 1 man-day = `hoursPerDay × 60` TDC. |
| `ruleSelectors` | `["Recommended"]` | Rule selectors of Code Analyzer: engines, tags, severities or rule names, combined with a colon (`pmd:Security`). |
| `severityCosts` | 60, 30, 15, 5, 2 | Cost of a finding, in TDC, by severity of its [rule](../rules.md). |
| `rules.<engine:rule>.enabled` | `true` | `false` disables a rule. |
| `rules.<engine:rule>.cost` | its severity's | Cost of a finding of this rule, in TDC. |
| `goal` | none | Debt to reach (`debt`, in TDC) by a date (`date`, `YYYY-MM-DD`), shown by `sf tdc history`. |
| `game.rewardDeletedFiles` | `false` | Whether deleting a whole file earns the TDC of its debt. |
| `sourceDirs` | `packageDirectories` | Folders to scan, relative to the project root. |

The `code-analyzer.yml` of the project applies too: its rule overrides (severity, tags), its ignored files and its
suppressions.

Changing a rule or a cost **re-baselines** the debt: the commit that changes it neither wins nor loses TDC, see
[the ledger](./ledger.md#who-paid-what).

## Excluded files

The files excluded by `.forceignore` are not scanned, as with `sf project deploy`, nor the files of `ignores.files`
in `code-analyzer.yml`. LWC `__tests__` folders are never
scanned.
