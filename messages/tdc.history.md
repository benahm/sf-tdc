# summary

Show how the debt evolved, commit by commit, and when it will be paid off.

# description

Reads every version of .tdc/ledger.json in git history and compares each commit with its parent: the debt that disappeared was paid by the author of the commit, the debt that appeared was created by them. Debt found again in another file (a rename, a refactoring) was moved, neither paid nor created.

The first ledger is the baseline: its debt was not created by its commit. A commit that changes the rules or their costs re-baselines the debt the same way. Merge commits are skipped: the commits of the merged branch already count.

From the pace of the history, the command forecasts when the debt reaches 0, and how far the goal of .tdc/config.json is.

# flags.since.summary

Only commits more recent than this date (anything git log --since accepts: 2026-09-01, "3 months ago"...).

# flags.limit.summary

Number of most recent commits to show. The forecast uses the whole history.

# info.empty

No commit of %s yet. Run sf tdc scan and commit the ledger.

# info.debt

💰 Debt: %s (%s)

# info.paid

Over %s commits: paid %s, new debt %s TDC.

# info.forecast

📈 At this pace (%s TDC/day), the debt is paid off on %s.

# info.growing

📉 The debt grows by %s TDC/day: no payoff in sight.

# info.goal

🎯 Goal %s by %s: %s · %s

# info.onTrack

on track

# info.offTrack

projected %s: speed up!

# examples

- Show the history of the debt:

  <%= config.bin %> <%= command.id %>

- Show the commits of the last 3 months:

  <%= config.bin %> <%= command.id %> --since "3 months ago"
