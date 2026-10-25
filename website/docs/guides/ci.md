---
title: CI setup
---

[`sf tdc check`](../commands/tdc-check.md) scans the project and fails (exit code 1) when:

- `.tdc/ledger.json` is missing or out of date: a payment without its ledger would give its TDC to someone else;
- with `--base <ref>`, the debt grew since the ledger of that ref: paying more than you create passes;
- with `--max-debt <TDC>`, the debt is above the limit.

It needs the history of the base branch (`fetch-depth: 0`), Java and Python for [the rules](../rules.md), and no
org.

## GitHub Actions

Check every pull request against its target branch:

```yaml
name: technical debt
on:
  pull_request:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v5
        with:
          node-version: 22
      # Code Analyzer runs PMD on Java and the Flow engine on Python
      - uses: actions/setup-java@v5
        with:
          distribution: temurin
          java-version: 21
      - uses: actions/setup-python@v6
        with:
          python-version: '3.12'
      - run: npm install --global @salesforce/cli
      - run: |
          mkdir -p ~/.config/sf
          echo '["sf-tdc"]' > ~/.config/sf/unsignedPluginAllowList.json
          sf plugins install sf-tdc@beta
      - run: sf tdc check --base origin/${{ github.base_ref }}
```

### Comment the pull request

`--report-file` writes the report as Markdown, ready to post:

```yaml
      - run: sf tdc scan --dry-run --report-file tdc-report.md
      - run: gh pr comment ${{ github.event.pull_request.number }} --body-file tdc-report.md --edit-last || gh pr comment ${{ github.event.pull_request.number }} --body-file tdc-report.md
        env:
          GH_TOKEN: ${{ github.token }}
```

## Before each commit

A git hook keeps the ledger up to date without thinking about it. With [husky](https://typicode.github.io/husky/),
`.husky/pre-commit`:

```bash
sf tdc scan
git add .tdc/ledger.json
```

## JSON

Every command supports `--json`, with a format pinned by the [schemas](https://github.com/benahm/sf-tdc/tree/main/schemas)
of the repository: `sf tdc check --json` returns `passed`, `debt`, `ledgerUpToDate`, `sinceBase` and `failures`.
