---
title: Deriving state from Linear and git
parent: .skills/1-ship/run-autonomous-project
owner: diplo
preview: >-
  The run keeps no ledger. Where each ticket and project stands is read from
  Linear and from git with GitHub every time, fresh run or --resume, through a
  ticket table and a project table whose first matching row decides what to do.
---
# Deriving state from Linear and git

The run keeps no ledger. Where a project or a ticket stands is read from two places every time: Linear (project state, ticket state, the closing and park comments) and git with GitHub (which unit branches exist, which pull requests are open or merged, what is on `<target>`). A fresh run and a resumed run use the same tables; on a fresh run every ticket lands on the last row. What an agent remembers, or what a file in the working tree claims, is not state.

`--resume` changes two things only, both at the top of the run. It accepts a plan where work already started, where a fresh launch refuses one. And it posts the resume entry, because a run only needs resuming after a human acted.

## What to read

For a ticket, one **fetch-tier** helper call (`models.fetch`, the "project snapshot" brief in `references/helpers.md`) returns all of it:

- the Linear state, the closing comment if one exists (a comment whose first line is `**Run summary**`) with its `status` and `landed`, and the park comment if one exists (first line `**Parked**`);
- the branch for that ticket number, from `git ls-remote --heads origin` (see "Branch names" in `references/contract.md`), and in `direct` landing whether its tip is an ancestor of `origin/<target>`;
- in `pr` landing, the pull request for that ticket, found by the head branch's ticket number rather than through the branch, because the run deletes a unit branch once its ticket is closed:

  ```bash
  gh pr list --state all --limit 1000 \
    --json number,url,state,baseRefName,headRefName,mergedAt,mergeCommit \
    --jq '.[] | select(.headRefName | test("/hex-<ticket>-"))'
  ```

  Several pull requests for one ticket means a repair happened: the newest one decides the row. The `landed` field of a closing comment is a second witness. When the two disagree, GitHub wins and the disagreement goes into the summary's `interventions`.

"Landed" in the table below has the meaning `landing` gives it in the contract. For a ticket whose branch was already deleted, the closing comment's `landed` value is checked instead: the pull request is merged, or the SHA is an ancestor of `origin/<target>`.

When `<target>` is not `main`, a ticket a human landed on `main` before `<target>` was cut from it counts as landed too: its pull request is merged into `main` and its merge commit (`mergeCommit.oid`) is an ancestor of `origin/<target>`. Row 6 below is for pull requests still open; a merged one is judged by this rule.

## Ticket table

Used by the project orchestrator for each unit ticket, in `blockedBy` order. First matching row wins.

| # | Linear | Git and GitHub | Action |
|---|---|---|---|
| 1 | closing comment `parked` | any | skip; carry the `PARK-n` lines into this project's summary. A human who wants it retried deletes that comment before resuming |
| 2 | canceled or duplicate | any | skip |
| 3 | Done, closing comment `done` | landed | skip |
| 4 | Done | not landed | `halted`: Linear and git disagree and the run cannot tell which is right |
| 5 | anything not caught above | landed | bookkeeping only: spawn the unit agent with `resume_at: close` to post the missing closing comment, set Done and delete the branch |
| 6 | any | `pr`: pull request open against a base other than `<target>` | `halted`, naming the pull request and both branches |
| 7 | any | `pr`: pull request closed without merging, no `parked` closing comment | `halted`: a closed pull request is a human decision the run cannot read |
| 8 | anything not caught above | `pr`: pull request open against `<target>` | spawn the unit agent with `resume_at: review`. It sets In Review if needed and re-enters the PR loop at the mergeability check. Review rounds already spent are counted from the `**Review round` comments on the pull request |
| 9 | anything not caught above | branch exists, not landed, no open pull request | spawn the unit agent with `resume_at: implement`. It checks the branch out, reads `git log origin/<target>..HEAD` to see what is already built, and carries on. Gate fix rounds restart at zero: they are not recorded anywhere, and a resume is a human decision to try again |
| 10 | anything not caught above | no branch | spawn the unit agent fresh. This is every ticket of a fresh run |

Rows 8 to 10 ignore the Linear state on purpose: git says how far the work got, and the unit agent sets the state that matches. A closing comment whose status is `halted` selects no row of its own: the halt is what the human just repaired, so the ticket follows the row its git state selects, 8, 9 or 10.

## Project table

Used by the project orchestrator before the unit loop, first matching row wins. An initiative's root decides first whether to run the project at all, with its own table in the `run-autonomous-initiative` skill.

| # | Linear | Action |
|---|---|---|
| 1 | project completed | return `done` with nothing to add. In a project run, print that the project is already completed |
| 2 | phase-close ticket Done, closing comment `done` | bookkeeping only: project status update, project completed |
| 3 | project started, or any unit ticket on a row of the ticket table other than 2 and 10 | work already started: without `--resume` at the top of a project run, stop the launch. Otherwise run the unit loop over the ticket table, then close the project |
| 4 | anything else | a fresh project: set it started, run the unit loop, close the project |
