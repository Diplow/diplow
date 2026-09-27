---
name: new-ticket
description: "Create a well-formed Linear ticket in the Hexframe team. It has a title, a structured description (context, goal, next-steps checklist), a due date, a project, self-assigned, and the right starting state (In Progress if you're picking it up now). Use when someone says \"create a ticket\", \"open a HEX ticket\", \"track this in Linear\", \"make a ticket for X\", or when another skill (e.g. do-ticket) needs a ticket minted. A ticket without a due date or a project drops out of planning, so this skill makes sure yours never does. Tickets are always drafted in English, whatever language the request came in, because the title feeds the branch, the PR and the commit log. Also covers updating an existing ticket to meet the standard. Do NOT use to triage an inbound bug report, idea or piece of feedback: that starts with a duplicate check, which this skill doesn't do."
title: new-ticket
parent: .skills/1-ship/new-ticket
owner: diplo
preview: >-
  Mint a Hexframe Linear ticket that meets the bar: imperative English title,
  context, goal and next-steps checklist, due date, project, assignee, state.
  Drafted and shown before creation. Use for work you're about to do, or to
  bring an existing ticket up to the bar. Not for triaging inbound reports.
---

# Create a Linear ticket that passes the bar

Mint a ticket that carries **intent, commitment, and a plan**, not a title floating in the backlog. This skill is for work you are about to do. An inbound bug report, idea or piece of feedback starts with a duplicate check instead (`mcp__hodor__Linear_mcp_Personal__list_issues` with a `query` on its keywords), which this skill doesn't do. The ticket is where intent lives: `/do-ticket` starts work from it, and the branch, the commits and the PR all carry its key. A malformed ticket breaks every link after it.

## The bar (why each field is required)

- **Due date.** A commitment, not an estimate. No due date means the ticket is invisible to prioritization.
- **Project.** Where it belongs. Orphan tickets don't show up in project views, so nobody plans around them.
- **Assignee.** Yourself, if you're the one doing it. Unassigned means unowned.
- **State.** `In Progress` if you're starting now; `Todo` if it's queued. Never leave a ticket you're actively working on in `Backlog`.
- **Description with a next-steps checklist.** The description is the ticket's *plan*, readable by humans and agents alike. `/do-ticket` reads it to gather context; anyone else reads it to understand scope without asking.
- **English.** Title, description, checklist, every field. The repos are written in English, and the ticket is the head of the chain that ends there: `/do-ticket` cuts the branch slug from the title, and the branch name, the commits and the PR carry it on. A French ticket forces a translation at every hop, or worse, doesn't, and the French rides all the way into the branch name and the commit log.

## Workflow

### 1. Resolve the team and project

Use the Linear MCP tools (prefix `mcp__hodor__Linear_mcp_Personal__`). If none is exposed, say so and stop: the user needs to connect Linear first. Failing here costs nothing; failing after the user has approved a draft throws the draft away.

```
mcp__hodor__Linear_mcp_Personal__list_teams      query: "Hexframe"   # confirm the team
mcp__hodor__Linear_mcp_Personal__list_projects   team: "Hexframe"    # candidate projects
```

If the user named a project, match it; otherwise show the shortlist and ask which one fits. **Never silently create a project-less ticket.** If truly none fits, say so and let the user decide. That usually means a project is missing, and creating it is the user's call.

### 2. Draft the ticket, show before creating

Write in **English**, whatever language the request came in. The conversation may happen in French; the ticket is the point where it becomes an artifact the repo will carry, so it switches. Translate the intent rather than the words: a request phrased "faut qu'on arrête de logger les tokens" becomes "Stop logging bearer tokens in the proxy access log", not a literal rendering. Don't ask which language to use, and don't offer a French version alongside.

Two things keep their original wording: **quoted material** (a message, a user's bug report, an upstream error string), quoted verbatim with English written around it, and **identifiers that exist in the code or product** (a translation key, a database column), which are tokens, not prose.

Write it in the voice defined once in `.skills/writing-tone.md`: plain words over impressive ones, no AI tells, and a Context section that says what happened rather than that this is a pivotal step.

Compose and show the user:

- **Title.** Imperative, specific, no ticket-speak ("Add OAuth scopes to the GitHub connector", not "GitHub improvements").
- **Description** in three parts:
  1. **Context.** Why this exists now, in a sentence or two. Link the PR, doc or ticket that spawned it.
  2. **Goal.** The observable end state; how we'll know it's done.
  3. **Next steps.** A markdown checklist (`- [ ] …`) of the known steps. This is the part `/do-ticket` and future sessions resume from. Write it as instructions to a competent stranger. It should end by naming the deliverable and where it lands: a PR into which repo, or a change landed directly on `main` where the repo works that way.
- **Due date.** Propose one from the scope (small: a couple of days; default to end of week if genuinely unsure). The user can override, but the ticket doesn't ship without one.
- **Project**, **assignee** (the user), **state** (`In Progress` if starting now, else `Todo`).
- **Attribution.** End the description with
  `_Created with skill_ [new-ticket](https://github.com/Diplow/diplow/blob/main/.skills/1-ship/new-ticket/SKILL.md)`.
  Linear renders standard markdown. Anyone landing on the ticket cold can then
  see how it was shaped, and mint the next one the same way. Tickets that
  `/do-ticket` later edits inherit this. It ticks the checklist; it doesn't
  restamp it.

Adjust until the user approves. **Do not create before approval.**

### 3. Create it

```
mcp__hodor__Linear_mcp_Personal__save_issue
  team:        "Hexframe"
  title:       "<title>"
  description: "<the three-part description>"
  project:     "<project name or id>"
  dueDate:     "YYYY-MM-DD"
  assignee:    "me"
  state:       "In Progress"   # or "Todo"
```

No `id` on creation; passing one updates an existing ticket. If anything didn't take, call `save_issue` again with the returned `id` and the missing fields. The ticket must meet the full bar before you report it created.

### 4. Report

Give back the ticket key and the URL the tool returned, and name the natural next verb: start work on it with `/do-ticket HEX-XXX`.

## Notes

- **Updating an existing ticket to the bar** is in scope: fetch it (`mcp__hodor__Linear_mcp_Personal__get_issue`), diff against the bar, propose the fixes, apply on approval (`save_issue` with its `id`). A French title or description counts as a miss. Propose the translation with the rest, and show it side by side so the author can check you kept the intent. Comments are not rewritten: they're a conversation that already happened.
- Ticket keys are `HEX-XXX`; branch names derive from them (`{type}/hex-{xxx}-{slug}`, see `/do-ticket`). That key, carried from ticket to branch to commit or PR, is what makes the work traceable in both directions.
- Keep it proportionate. A ticket for a 30-minute fix still needs the bar (it's cheap), but its checklist can be one line.
