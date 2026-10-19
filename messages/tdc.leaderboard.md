# summary

Rank the developers by the TDC they earned paying the debt.

# description

The debt is counted in TDC, Technical Debt Coins: every commit that pays debt earns its author the TDC of that debt; every commit that creates debt costs them the same. The TDC earned give a rank (Intern, Collector, Bailiff, Debt Collector, Legendary Collector), and some payments earn badges.

The scores come from the history of .tdc/ledger.json in git (see "sf tdc history"). Authors are told apart by their email: map the emails of a same person with a .mailmap file at the root of the repository.

With --me or --author, shows the card of one developer: rank, badges and latest payments. With --team, shows the total of the team without naming anyone.

# flags.since.summary

Only commits more recent than this date (anything git log --since accepts: 2026-09-01, "2 weeks ago"...).

# flags.me.summary

Show your own card, from the email of git config user.email.

# flags.author.summary

Show the card of a developer, by name or email.

# flags.team.summary

Show the total of the team, without naming anyone.

# flags.limit.summary

Number of developers to show.

# flags.payments.summary

Number of latest payments to show on a card.

# error.noEmail

--me needs an email: set it with git config user.email.

# error.unknownAuthor

%s has not paid nor created any debt yet.

# info.empty

No debt paid or created yet: commit the ledger, pay some debt, and come back.

# info.card

👤 %s — %s (%s TDC · #%s of %s)

# info.nextRank

Next rank: %s in %s TDC

# info.badges

Badges: %s

# info.noBadge

No badge yet.

# info.team

👥 Team: %s TDC earned over %s commits · paid %s · new debt %s TDC

# examples

- Show the leaderboard:

  <%= config.bin %> <%= command.id %>

- Show your own card:

  <%= config.bin %> <%= command.id %> --me

- Rank the sprint that started on October 6:

  <%= config.bin %> <%= command.id %> --since 2026-10-06
