---
name: run-autonomous-initiative
description: "Execute a whole Linear initiative with no human in the loop, as a hierarchy of agents. The main session is the root: it runs the initiative's projects in the config's order, each through the run-autonomous-project skill one level down, whose unit agents take one ticket each on a short-lived branch that lands on main once green. Gates, review rounds, halting rules and models come from a committed run config (run.yaml). State lives in Linear and git, so a stopped run restarts with --resume. Use only on an explicit request such as \"/run-autonomous-initiative <initiative> --config <path/to/run.yaml> [--resume]\", \"run this initiative autonomously\" or \"resume the autonomous run\". One project without an initiative is run-autonomous-project. One ticket with a human at the wheel is do-ticket."
argument-hint: "<initiative> --config <path/to/run.yaml> [--resume]"
title: run-autonomous-initiative
parent: .skills/1-ship/run-autonomous-initiative
owner: diplo
preview: >-
  Runs a Linear initiative's projects one after the other with nobody
  watching, each through run-autonomous-project, so every ticket lands on main
  on its own short-lived branch. The root checks each project boundary itself
  and reports on the initiative. Use only when explicitly asked to run an
  initiative autonomously, or to resume one.
---

# run-autonomous-initiative. One initiative, one project at a time, nobody to ask

Linear holds the plan: an initiative, one project per phase, one ticket per unit of work, ordered by `blockedBy`. This skill executes that plan end to end without a human. It owns the initiative level only. Each project runs through `run-autonomous-project` (`.skills/1-ship/run-autonomous-project/SKILL.md`), and everything below the root (the contract, the project orchestrator, units, the PR loop, state, helpers, the wait scripts) lives in that skill. It knows nothing about the target codebase. Everything specific comes from three places: the run config, the Linear descriptions, and the target repo's `CLAUDE.md` files.

| Level | Role | Linear | Git |
|---|---|---|---|
| 0 | root, the session that invoked the skill | initiative: its project list and status updates | none of its own; it re-runs gates on `main` at each project boundary |
| 1 | project orchestrator, from `run-autonomous-project` | project | none of its own; lands the phase-close fix if one is needed |
| 2 | unit agent | ticket | a short-lived branch off `main`, landed through a pull request or a fast-forward |
| 3 | helpers: fetch, planner, fix-up, reviewer | none | none |

The hierarchy exists for one reason: a run lasts days, and no orchestrator's context may fill up. So orchestrators hold briefs and summaries, and leaves hold the work. It uses all three subagent levels the harness offers, and "Delegation" in `run-autonomous-project`'s contract says what happens on a shallower one.

## Invocation

```
/run-autonomous-initiative <initiative> --config <path/to/run.yaml> [--resume]
```

`<initiative>` is the Linear initiative's name and must equal `initiative` in the config. A missing argument, or a mismatch between the two, stops the launch with the usage line above. That, and the warnings of preflight, is all this skill says to the user before it starts, and it asks nothing after.

## 1. Preflight

First check that `run-autonomous-project` is installed next to this skill: `../run-autonomous-project/references/contract.md` exists relative to this skill's directory. If not, print "install run-autonomous-project next to this skill (.skills/1-ship/run-autonomous-project)" and stop, since the rest of preflight lives in that skill.

Then run the preflight of `run-autonomous-project`'s `references/top.md`, the checks and then the warnings, with the rows marked for an initiative run. It fixes the landing mode and the home branch.

## 2. Become the root

Note the absolute paths of this skill's directory and of `run-autonomous-project`'s next to it. Every brief you write passes the latter down as `skill_dir`, because a subagent cannot find the role files otherwise. Resolve the config path to an absolute one as well.

The contract and the files below live in `run-autonomous-project` rather than here, because that skill runs on its own and owns them; it keeps their names stable for this one.

Read `run-autonomous-project`'s `references/contract.md`, then follow `references/root.md` to the end. Every other level is reached through a brief that names its role file.

| File | Read by | Holds |
|---|---|---|
| `references/root.md` | root | what the initiative is in the Linear tools, the project loop and its table, project boundary checks, the root form of the path guard, initiative status updates, finish, halt |
| `../run-autonomous-project/references/top.md` | root | preflight checks and warnings, the landing mode, the resume entry, the halt |
| `../run-autonomous-project/references/contract.md` | every agent, first | the two ways in, trunk-based landing, config keys, the summary block, done / parked / halted, claim verification, the hard rules, the path guard, register and Linear formats, tiers and models |
| `../run-autonomous-project/references/project.md` | project orchestrator | project snapshot, ticket minting, the unit loop, project close |
| the rest of `run-autonomous-project`'s `references/` and `scripts/` | project orchestrator, unit agent, helpers | units, the PR loop, state tables, helper briefs, the bounded waits |

## Invariants

`run-autonomous-project`'s `SKILL.md` lists the invariants every level keeps, and its contract states them in full, with the reasons. Two are specific to this level:

- **Projects run in the config's order, one at a time.** A project starts only after the previous one is completed, its gates re-run green on `main` by the root, and the path guard silent. Every unit lands on `main` on its own; there is no initiative branch and no final pull request.
- **The initiative is reported on, never edited.** The Linear tools can only list its projects and post its status updates. The root creates no project and changes no description.
