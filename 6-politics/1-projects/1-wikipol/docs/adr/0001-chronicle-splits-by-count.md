---
title: A Chronicle splits by count, not by calendar
parent: 6-politics/1-projects/1-wikipol/docs/adr
owner: diplo
preview: >-
  A Source files its Digests in a Chronicle of Periods that each hold at most six
  sub-Periods or six Digests, splitting when full, because a calendar tree breaks
  the rule of 6 (PaduTeam published 283 videos in 2025), and each Period
  summarizes its stretch of time.
status: accepted
---
# A Chronicle splits by count, not by calendar

A Source files its Digests by date in its Chronicle, a tree of Periods, each a date range holding at most six sub-Periods or six Digests, which splits when it overflows. A calendar tree can't keep the rule of 6 (year to month is twelve slots, and PaduTeam published 283 videos in 2025, two dozen a month), and a flat list gives it up. Each Period's Preview and Body summarize its stretch of time, so the Chronicle reads at every scale. A split moves Digests, and the References pointing at them follow.

## Considered Options

- **Calendar tree** (year, month, week): a year's twelve months already break the rule of 6, and a Source publishing more than six a month, as PaduTeam does, breaks it again under each month.
- **Digests placed by theme**, the date only a field: a theme is a reading, and the Source's hexframe should stay neutral until a structure emerges; the other five slots of a Source are left free for it.
