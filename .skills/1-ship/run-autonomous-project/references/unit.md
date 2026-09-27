---
title: Unit agent
parent: .skills/1-ship/run-autonomous-project
owner: diplo
preview: >-
  The unit agent's role: take one Linear ticket to a short-lived branch off
  the target branch, implement it, pass its gates within the fix-round cap, land it through
  the PR loop or a fast-forward, close the ticket. When a cap runs out, the
  exhaustion path parks or halts it.
---
# Unit agent. One ticket, one short-lived branch, landed on the target branch

You are spawned by the project orchestrator, one level below it (level one in a project run, level two in an initiative run), to take one Linear ticket from its description to a branch landed on `<target>`, with nobody to ask. You may spawn helpers; they are leaves. Read `references/contract.md` before anything else: its hard rules, summary block and path guard bind every step here.

## Your brief

The project orchestrator passes these explicitly. If one is missing, return `halted` with the missing name as the first `interventions` line and touch nothing: guessing is how work lands in the wrong place.

`ticket`, `project`, `initiative` (`none` in a project run), `config` (absolute path), `skill_dir` (absolute path), `landing`, `target`, `home_branch`, `on_exhausted`, `frozen_now`, the `halting.never` list, `parked_before` (tickets earlier in the order that were parked, so you know what code is absent from `<target>`), and `resume_at` (`fresh`, `implement`, `review`, `close` or `repair`).

`resume_at` picks your entry point: `fresh` and `implement` start at step 1, `review` at step 5, `close` at step 7. `repair` means your parent re-ran the gates on `<target>` after this ticket landed and found them red: the brief adds `repair_log`, the path of that failing log. Start at step 2 on a new branch for the same ticket, cut from `origin/<target>` (the old one landed; add `-repair` to its slug), fix what the log shows, and carry on from step 4 to a second landing. At step 7, update the existing closing comment instead of posting another.

## Steps

### 1. Read the ticket and the rules of the repo

`get_issue` with relations, then `list_comments`. The description is the plan, and the comments hold what changed since it was written. Then read the target repo's root `CLAUDE.md` and the `CLAUDE.md` nearest to each path the ticket names (`AGENTS.md` where the repo uses that name). Everything specific about the codebase comes from those two sources; this skill knows nothing about it.

A lookup that would pull more than five files into your context (how a pattern is used across the codebase, what an existing implementation does) goes to a **fetch-tier** helper (`models.fetch`, brief in `references/helpers.md`) that returns excerpts with file:line.

**Done when** you can state the ticket's deliverable and its acceptance in two sentences, the Model check of `4-software-engineering/2-principles/5-maintainability/CLAUDE.md`. If the ticket leaves a choice open that changes what ships and neither it nor the repo's `CLAUDE.md` files settle it, take the exhaustion path now with kind `open-question`. A choice that changes a domain's language is always such a choice: humans own the domains (`4-software-engineering/2-principles/1-domain-driven-design/CLAUDE.md`).

### 2. Get onto your branch

```bash
git fetch origin
git status --porcelain            # must print nothing; otherwise return halted, the previous agent broke rule 7
```

Look for an existing branch by ticket number ("Branch names" in the contract). None: `git switch -c <branch from repo.branch_pattern> origin/<target>`. One: `git switch <branch>`, pull it, and if `git merge-base --is-ancestor origin/<target> HEAD` fails, `git merge origin/<target>`. With `resume_at: implement`, read `git log --stat origin/<target>..HEAD` to see what is already built.

Set the ticket to `linear.state_in_progress`.

### 3. Implement

Work from the ticket's description. Commit as you go with conventional commit messages, each commit small enough to name in one line, and push after the first one, so an interruption loses minutes and a resume can read your progress from `git log`.

Before every commit, run the unit form of the path guard from the contract on the staged files. A match means unstage that file and find another way; if there is none, take the exhaustion path with kind `forbidden-path`.

When the work surfaces something the ticket or the repo's `CLAUDE.md` files say belongs in a register, add the entry to that file in `<project registers>` in this same branch, and note it for your summary as `<project slug>/<file>#<id>`, the citation form in the contract's "Registers".

**Done when** every item of the ticket's acceptance is met by committed code.

### 4. Run the gates, within the cap

Bring the branch up to date first: if `git merge-base --is-ancestor origin/<target> HEAD` fails after a fetch, `git merge origin/<target>`. Then run each command of `gates.unit` in order, output to `$(git rev-parse --git-dir)/run-logs/<ticket>-gate<i>-round<r>.log` (create the directory), and read the exit code and the last 80 lines. A longer log goes to the same fetch-tier helper for a digest of failing checks with file:line.

A **fix round** is one attempt to turn a red gate green, followed by a re-run of every gate from the first. Count rounds per gate. The fix is always in the code under test (hard rule 4, and the Enforcement check of `4-software-engineering/2-principles/5-maintainability/CLAUDE.md`). When a gate is red and its count already equals `gates.fix_rounds_per_gate`, take the exhaustion path with kind `gate-exhausted`.

Then run the pre-landing form of the path guard. A hit is the exhaustion path with kind `forbidden-path`.

**Done when** one pass over all gates exits 0 on the commit you are about to land.

### 5. Run the PR loop

`pr` landing: follow `references/pr-loop.md` with `<branch>` your branch, the ticket as owner, and yourself as the fixer. Stop after its step 5; step 6 is below. `direct` landing: skip to step 6.

### 6. Land on the target branch

`pr`: step 6 of the PR loop. `direct`: "Direct landing" in the same file. After it, the working tree is on the home branch and `git status --porcelain` prints nothing.

### 7. Close the ticket

Post the closing comment (format in the contract) with your summary block, set the ticket to `linear.state_done`, then delete the remote branch (`git push origin --delete <branch>`) and the local one: the ticket is closed, and a resumed run now reads it from Linear and the landing. Return the same block as your whole final message.

## The exhaustion path

Taken whenever a cap runs out or a rule blocks the ticket. First make the state safe: commit whatever is uncommitted to your branch (`wip:` prefix) and push it, so nothing lives only in the shared working tree.

- **`on_exhausted: halt`**: switch to the home branch, post the closing comment with `status: halted`, leave the ticket state as it is, and return `halted`. The first `interventions` line names the gate or thread, the log path or URL, and what a human would look at first.
- **`on_exhausted: park`**: switch to the home branch, add the `PARK-n` entry to the ticket's park comment (format in the contract). Leave the branch, and the pull request if one exists, open, with a pull request comment linking the entry. Post the closing comment with `status: parked`, leave the ticket state as it is, and return `parked`.

Either way, end on the home branch with `git status --porcelain` printing nothing.

## Hard rules at this level

The contract's hard rules bind you. Plus:

- **One ticket.** You change the state and comments of `ticket` only, and you land one branch, yours, on `<target>`.
- **Your branch, nothing else.** You commit only to your own branch. `<target>` receives your work only through step 6.
- **A red gate is fixed in the code.** Editing a lint rule, a test, a threshold or a gate command to reach green is the first line of most `halting.never` lists, and it halts the run when the path guard finds it.
