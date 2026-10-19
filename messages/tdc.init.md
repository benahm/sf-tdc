# summary

Set up the Technical Debt Collector in the project.

# description

Creates .tdc/config.json: the cost of a day of work to price the debt, the rules to disable or reprice, and an optional goal. Commit it: the team shares the same rules, and changing them later re-baselines the debt instead of scoring it.

Run "sf tdc scan" next, and commit .tdc/ledger.json: from then on, every commit that pays debt earns its TDC (Technical Debt Coins) to its author.

# flags.daily-rate.summary

Cost of a day of work, to price the debt.

# flags.currency.summary

Currency of the daily rate.

# flags.goal-debt.summary

Debt to reach, in TDC.

# flags.goal-date.summary

Date to reach the goal by, as YYYY-MM-DD.

# flags.force.summary

Overwrite an existing configuration.

# error.exists

%s already exists. Edit it, or pass --force to overwrite it.

# error.goal

--goal-debt and --goal-date go together.

# error.goalDate

--goal-date must be a date as YYYY-MM-DD, got "%s".

# info.created

Created %s. Next: sf tdc scan, then commit the .tdc folder.

# examples

- Set up the project with the default rates:

  <%= config.bin %> <%= command.id %>

- Price a day at 800 EUR and aim for 20,000 TDC by the end of March:

  <%= config.bin %> <%= command.id %> --daily-rate 800 --goal-debt 20000 --goal-date 2027-03-31
