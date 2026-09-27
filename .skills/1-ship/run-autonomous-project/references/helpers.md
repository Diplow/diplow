---
title: Helper briefs
parent: .skills/1-ship/run-autonomous-project
owner: diplo
preview: >-
  Briefs and return formats for the leaves of an autonomous run: fetch-tier
  lookups (project snapshot, CI digest, review threads, code lookup), the
  work-tier planner and fix-up, and the judge-tier reviewer. Helpers own no
  ticket and no branch, spawn nothing, and never ask.
---
# Helper briefs

Helpers are leaves: they own no ticket, no branch they create themselves (a fix-up works on the branch its brief names) and no pull request, they spawn nothing, and they return a fixed format instead of the summary block. The project orchestrator and the unit agent write a helper's brief from the templates below. Every brief opens with the common lines from "Delegation" in `references/contract.md` (skill directory, config path, `landing`, `target`, `home_branch`, initiative, project, `on_exhausted`, `frozen_now`, the `halting.never` list verbatim, read the contract first) and closes with the helper's return format.

A helper that cannot finish says so in its return, with the evidence. It never asks a question and never widens its task.

## Fetch and lookup

**Fetch tier** (`models.fetch`). Read and digest, so raw payloads stay out of the caller's context. Read-only on git and GitHub, read-only on Linear. Four briefs:

| Brief | Input | Return |
|---|---|---|
| project snapshot | project name, `landing` | project id and state; then one line per ticket: `id · title · state · blockedBy ids · closing comment status and landed, or none · park comment PARK ids, or none · branch or none · landed yes or no · PR number, state, base and merge commit SHA, or none`, read as described in "What to read" of `references/state.md` |
| CI digest | failed run ids | per run: failing job and step, file:line, the message in at most 5 lines, and `code` or `infrastructure` with the reason |
| review threads | pull request number | one deduplicated list of actionable findings: `source · thread id or comment URL · file:line · reviewer's level · the claim in one sentence`, collected from the surfaces in step 5 of `references/pr-loop.md`, long collapsed `<details>` analysis blocks stripped. Then the count of unresolved threads |
| code lookup | a question and where to look | excerpts with file:line that answer it, at most 60 lines in total, and what it could not find |

## Planner

**Work tier** (`models.planner`). Spawned by the project orchestrator when the config sets `mint_tickets` and the project holds only its phase-close ticket.

Task: read the project description (`get_project`), its exit criteria and scope paths, the repo's `CLAUDE.md` files for those paths, and the closing comments of the previous project's tickets when the description refers to them. Cut the work into unit tickets that each fit one short-lived branch and one pull request a reviewer can read, in the order they must land on `<target>`. Each ticket leaves `<target>` green on its own, since it lands before the next one starts. Create each with `save_issue`: `team` from the config, `project` this project, `assignee: "me"`, `state` the team's first state of type `unstarted` in `list_issue_statuses`, and `blockedBy` the ticket before it. Then add every new ticket to the phase-close ticket's `blockedBy`.

Each description has the shape the `new-ticket` skill defines (`.skills/1-ship/new-ticket/SKILL.md`), plus two parts the unit agent depends on: the paths in scope, and the acceptance as observable statements. Close each with the `run-autonomous-project` footer from the contract's "Linear conventions" in place of that skill's own, and skip its approval step. Write in English, in the voice of `.skills/writing-tone.md`.

Limits: this project only. No new project, no edit to the project description, no ticket for work the description does not ask for. An idea outside the description goes in the return, not in Linear.

Return: one line per ticket, `id · title · the line of the project description it serves · blockedBy`, then the out-of-scope ideas.

## Fix-up

**Work tier** (`models.fixup`). Spawned by the project orchestrator, which never edits code itself, for one fix round on the phase-close ticket's branch: a red `gates.phase` run on `<target>` (input is the log path), a red CI digest, or review findings (the triaged list with thread ids and the disposition decided for each).

Task: switch to the branch the brief names, creating it from `origin/<target>` if the brief says so. Make the smallest change that fixes the input, in the code under test and outside every guarded path. Run the path guard on staged files before each commit. Re-run the gate commands the brief names. For review findings, reply on each thread with what changed and the commit SHA, or with the waiver reason the brief gives, and resolve the threads that are settled, with the mutations in step 5 of `references/pr-loop.md`. Commit to that branch, push, and switch back to the home branch.

Return: commits made, the exit code of each gate, the threads replied to and resolved, and whatever is still failing with its evidence.

## Reviewer

**Judge tier** (`models.reviewer`). Spawned by a unit agent or the project orchestrator when a review finding's claim is in doubt, or when a ticket asks for a unit's output to be reviewed against the repo's conventions. Read-only.

Task: for each finding, read the cited lines and what the repo's docs say about them, and rule on the claim, not on who made it. For a review against conventions, the bar is the owner's principles in `4-software-engineering/2-principles/`, and the target repo's `CLAUDE.md` files.

Return: per finding, `VALID`, `PARTIALLY VALID` or `FALSE`, with file:line evidence and, for a valid one, the smallest fix.
