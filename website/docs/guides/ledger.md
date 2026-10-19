---
title: The ledger
---

`.tdc/ledger.json` is the record of the debt. `sf tdc scan` writes it, you commit it, and every score comes from its
history in git: there is no server and no database.

## Format

```json
{
  "version": 1,
  "rules": {
    "apex-dml-in-loop": 30,
    "apex-soql-in-loop": 30
  },
  "findings": [
    {"id":"3f9c1a2b4d5e","rule":"apex-soql-in-loop","file":"force-app/main/default/classes/InvoiceService.cls","cost":30,"hash":"a1b2c3d4e5f6","snippet":"Invoice__c i = [SELECT Id FROM Invoice__c WHERE Id = :id];"}
  ]
}
```

- **One finding per line, sorted.** A pull request shows the debt it pays as removed lines and the debt it adds as
  added lines, and two branches only conflict when they change the same findings.
- **No line numbers.** A finding is identified by its rule, its file, its normalized source line (the `snippet`) and
  its rank among identical findings of the file. Adding code above it changes nothing.
- **`rules`** holds the cost of each enabled rule when the ledger was written.
- **Deterministic.** Scanning unchanged code rewrites nothing, so `sf tdc check` can compare it byte for byte.

## Who paid what

`sf tdc history` reads every version of the ledger in git and compares each commit with its parent:

| Change | Meaning | TDC of the author |
| --- | --- | --- |
| A finding disappeared, its file still exists | **paid** | + its cost |
| A finding appeared | **created** | − its cost |
| A finding disappeared and the same one (rule and snippet) appeared in another file | **moved** (rename, refactoring) | 0 |
| A finding disappeared with its file | **deleted** | 0, unless `game.rewardDeletedFiles` |

Some commits never score:

- **Baseline**: the first ledger of the history. Its debt existed before.
- **Rules changed**: a commit whose ledger has other rules or costs than its parent. Enabling a rule would otherwise
  charge its author for all the debt the rule finds.
- **Merge commits** are skipped: the commits of the merged branch already count. With a squash merge, the squashed
  commit counts, for the author of the pull request.

## Keep it up to date

A commit that pays debt without updating the ledger gives its TDC to the next commit that does. Run
`sf tdc scan` before every commit, and [`sf tdc check`](../commands/tdc-check.md) in CI to refuse a stale ledger.

## Merge conflicts

When two branches change the same findings, the ledger conflicts. Don't resolve it by hand: take either side and scan
again.

```bash
git checkout --theirs .tdc/ledger.json
sf tdc scan
git add .tdc/ledger.json
```

## Authors

Authors are told apart by their commit email. When a developer commits with several emails, map them in a
[`.mailmap`](https://git-scm.com/docs/gitmailmap) at the root of the repository:

```text
Alice Martin <alice@company.com> <alice.martin@laptop.local>
```
