---
title: Configuration
---

`.tdc/config.json` is created by [`sf tdc init`](../commands/tdc-init.md). Commit it: the team shares the same rules.

```json
{
  "dailyRate": 600,
  "currency": "EUR",
  "hoursPerDay": 7,
  "rules": {
    "apex-system-debug": { "enabled": false },
    "ui-aura-component": { "cost": 960 }
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
| `rules.<id>.enabled` | `true` | `false` disables a [rule](../rules.md). |
| `rules.<id>.cost` | the rule's | Cost of a finding, in TDC. |
| `goal` | none | Debt to reach (`debt`, in TDC) by a date (`date`, `YYYY-MM-DD`), shown by `sf tdc history`. |
| `game.rewardDeletedFiles` | `false` | Whether deleting a whole file earns the TDC of its debt. |
| `sourceDirs` | `packageDirectories` | Folders to scan, relative to the project root. |
| `minApiVersion` | `sourceApiVersion − 9` | Metadata older than this API version is debt (9 versions = 3 years of releases). |

Changing a rule or a cost **re-baselines** the debt: the commit that changes it neither wins nor loses TDC, see
[the ledger](./ledger.md#who-paid-what).

## Excluded files

The files excluded by `.forceignore` are not scanned, as with `sf project deploy`. LWC `__tests__` folders are never
scanned.
