---
name: run-autonomous-project
description: "Execute one Linear project with no human in the loop. The invoking session is the project orchestrator: it runs one unit agent per ticket in blockedBy order, each on a short-lived branch off main that lands on main once green, through a pull request, or a fast-forward when the repo lands directly on main. With repo.target_branch set, the units branch from and land on that project branch instead, and a human merges it into main. Gates, review rounds, halting rules and models come from a committed run config (run.yaml). State lives in Linear and git, so a stopped run restarts with --resume. run-autonomous-initiative runs this skill once per project of an initiative. Use only on an explicit request such as \"/run-autonomous-project <project> --config <path/to/run.yaml> [--resume]\", \"run this project autonomously\" or \"resume the autonomous project run\". One ticket with a human at the wheel is do-ticket."
argument-hint: "<project> --config <path/to/run.yaml> [--resume]"
title: run-autonomous-project
parent: .skills/1-ship/run-autonomous-project
owner: diplo
preview: >-
  Runs one Linear project of the Hexframe team to done with nobody watching:
  one unit agent per ticket, each on a short-lived branch that lands on main,
  or on a project branch the config names, once its gates are green. Settings come from a committed run.yaml; state is
  read back from Linear and git, so --resume picks up after a halt. Use only
  when asked to run a project autonomously.
---

# run-autonomous-project. One project, one landing per ticket, nobody to ask

Linear holds the plan: a project, one ticket per unit of work, ordered by `blockedBy`, and one phase-close ticket that owns the project's close. This skill executes that plan end to end without a human. Each ticket becomes a short-lived branch cut from `origin/<target>` and lands back on `<target>` once green, so `<target>` grows one ticket at a time. `<target>` is `main`, or the branch the config's `repo.target_branch` names: a project branch such as `project/design-system`, which a human merges into `main` once the project is done, or in an initiative run the initiative branch the root passes down. The skill knows nothing about the target codebase. Everything specific comes from three places: the run config, the Linear descriptions, and the target repo's `CLAUDE.md` files.

| Level | Role | Linear | Git |
|---|---|---|---|
| 0 | project orchestrator, the session that invoked the skill | project and its phase-close ticket | none of its own; it re-runs gates on the target branch and lands the phase-close fix if one is needed |
| 1 | unit agent | ticket | a short-lived branch off the target branch, landed through a pull request or a fast-forward |
| 2 | helpers: fetch, planner, fix-up, reviewer | none | none |

A run lasts hours or days, and no orchestrator's context may fill up. So the orchestrator holds briefs and summaries, and leaves hold the work. `run-autonomous-initiative` runs none of the steps below but reuses the rest. Its root reads `references/top.md` and `references/contract.md` itself, as the top of the run, and spawns the project orchestrator at level 1, which follows `references/project.md` and everything it names. The contract's "Two ways in" lays both cases side by side. The initiative links to these files by name, so a rename under `references/` or `scripts/` updates `run-autonomous-initiative` in the same change.

## Invocation

```
/run-autonomous-project <project> --config <path/to/run.yaml> [--resume]
```

`<project>` is the Linear project's name and must equal the `name` of one entry of `projects[]` in the config, byte for byte. A missing argument, or no matching entry, stops the launch with the usage line above. That, and the warnings of preflight, is all this skill says to the user before it starts, and it asks nothing after.

## 1. Preflight

Run the preflight of `references/top.md`, the checks and then the warnings, with the rows marked for a project run. It fixes the landing mode (`pr`, or `direct` when the repo's `CLAUDE.md` or `STACK.md` says changes land directly on `main`), the target branch (`repo.target_branch`, `main` when absent, created from `main` if the remote lacks it) and the home branch.

## 2. Print the launch summary

A dozen lines to the terminal, then carry on without waiting: project and its Linear state, config path and its last commit, the landing mode, the target branch, the home branch, the branch pattern, `on_exhausted` and `mint_tickets`, the gates, the caps, the model this session runs on, and the warnings from preflight. A human watching sees what is about to happen, and a human reading the transcript later sees what the run believed at launch.

## 3. Become the project orchestrator

Your own brief, which you fill in yourself. Every brief you write passes `config` and `skill_dir` down, because a subagent cannot find the config or the role files otherwise.

| Field | Value |
|---|---|
| `project` | the argument |
| `config` | the config path, resolved to an absolute one |
| `skill_dir` | this skill's base directory, as an absolute path |
| `initiative` | `none` |
| `landing`, `target`, `home_branch` | from preflight |
| `on_exhausted`, `mint_tickets` | from the project's `projects[]` entry |
| `frozen_now` | the `paths` of every `halting.frozen_after` entry whose project Linear shows as completed, or none |
| `halting.never` | the config's list, verbatim |

Read `references/contract.md`, then follow `references/project.md`. Two things there are yours alone, because you are the top of the run:

- **At its step 2.** Without `--resume`, row 3 of the project table stops the launch: print that a run already started on this project and that `--resume` continues it. Starting twice would run two orchestrators over one plan. With `--resume` on that row, post the resume entry of `references/top.md` before the unit loop.
- **When it says return.** Its summary block comes to the steps below instead of to a parent.

## 4. Finish

On `done`: print the summary block, the project's final status update, the landings, and the parked items with their `PARK-n` ids. The project is completed in Linear and every unit that was not parked is on the target branch. Parked units wait on their branches, and in `pr` landing on their open pull requests, for a human. When the target branch is a project branch, end with one more line: merging it into `main` is the human's, now that the phase-close ticket is done. The run never opens that pull request or makes that merge.

## 5. Halt

On `halted` or `parked`, follow "Halt" in `references/top.md`. Project.md's step 6 may already have posted the status update.

## Files

| File | Read by | Holds |
|---|---|---|
| `references/contract.md` | every agent, first | the two ways in, trunk-based landing and the target branch, config keys, the summary block, done / parked / halted, claim verification, the hard rules, the path guard, registers and Linear formats, branch names, tiers and models |
| `references/top.md` | the top of the run, in either skill | preflight checks and warnings, the landing mode and target branch, the resume entry, the halt |
| `references/project.md` | project orchestrator | project snapshot, ticket minting, the unit loop, project close |
| `references/unit.md` | unit agent | ticket to landed branch, gate rounds, the exhaustion path |
| `references/pr-loop.md` | unit agent, project orchestrator | open, mergeability, CI wait, review wait, capped rounds, merge; direct landing |
| `references/state.md` | project orchestrator | the decision tables that rebuild state from Linear and git, fresh or `--resume` |
| `references/helpers.md` | whoever spawns a helper | briefs and return formats for the leaves |
| `scripts/wait_ci.sh`, `scripts/wait_reviews.sh` | the PR loop | bounded waits on the head commit's runs and on what each reviewer left |

## Invariants

These hold at every level. The contract states them in full, with the reasons; they are repeated here so that reading this file alone is enough to know what the run will and will not do.

- **Trunk-based.** Every ticket is a short-lived branch off `origin/<target>` that lands on `<target>` once its gates are green, and in `pr` landing once CI and review rounds are done too. `<target>` is `main`, or the branch `repo.target_branch` names, which a human merges into `main`: a project branch after the project's phase-close ticket, an initiative branch after the initiative's last project. No other branch outlives its ticket.
- **Every line of the config's `halting.never` is a hard rule** in every role and every brief, next to the run's own: no project created, no initiative or project description edited, `.github/` and the config file left untouched, guarded paths checked mechanically before each commit, before each landing and after it.
- **Decide or park, never ask.** Where a supervised skill would ask the user, the run takes the answer from the config, the ticket or the repo's `CLAUDE.md` files, and parks the item with the question written down when none of them has it.
- **Caps end every loop.** `gates.fix_rounds_per_gate`, `reviews.max_rounds` and the bounded waits of the PR loop. When a cap runs out, the project's `on_exhausted` decides between `halt` and `park`.
- **A summary is a claim.** Five fields, never a transcript, and the parent re-runs the gates on `<target>` and re-reads the landing before recording either.
- **No ledger.** A restart reads Linear and git, through the same tables a fresh run uses. Progress goes to Linear comments and status updates, and to the terminal.
