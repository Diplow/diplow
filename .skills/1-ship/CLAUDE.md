---
title: Ship
parent: .skills/1-ship
owner: diplo
preview: >-
  Skills that move an intent to main: write the ticket, start work on it,
  describe the pull request, and run a whole Linear project or initiative
  autonomously. Trunk-based: short-lived branches off main.
---
# Ship

Skills that take an intent to `main`. Versioning is trunk-based: `main` is the only long-lived branch, and work goes back to it on short-lived branches named `{type}/hex-{num}-{slug}`. The one exception is an autonomous project run whose config names a project branch (`repo.target_branch`): its units land there, and I merge it into `main` once the project is done.

| Skill | Use it to |
|---|---|
| [[.skills/1-ship/new-ticket/SKILL\|new-ticket]] | Write a Linear ticket in the Hexframe team |
| [[.skills/1-ship/do-ticket/SKILL\|do-ticket]] | Start a ticket: branch, context, working mode, then the review loop |
| [[.skills/1-ship/pr-description/SKILL\|pr-description]] | Write the description of a pull request into `main` |
| [[.skills/1-ship/run-autonomous-project/SKILL\|run-autonomous-project]] | Run a Linear project's tickets to done, one PR each |
| [[.skills/1-ship/run-autonomous-initiative/SKILL\|run-autonomous-initiative]] | Run several projects of an initiative |
