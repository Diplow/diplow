---
title: autonomous runs
parent: 4-software-engineering/1-projects/1-hexframe/.run
owner: diplo
preview: >-
  How hexframe v0's projects run with nobody watching: run.yaml, the config
  run-autonomous-project reads, one project at a time on its own project
  branch, and the registers the runs write their decisions and open security
  findings to.
---
# autonomous runs

An inner child of hexframe: how its projects get built by [[.skills/1-ship/run-autonomous-project/SKILL|run-autonomous-project]] rather than ticket by ticket. [[4-software-engineering/1-projects/1-hexframe/STACK|STACK]] says why these runs land on a project branch.

| File | What it holds |
|---|---|
| `run.yaml` | The run config: target branch, gates, cubic as the reviewer, the `never` list, frozen and read-only paths, models |
| `registers/` | What the runs record, one folder per project, created by the first entry |

## One project at a time

hexframe v0's initiative is not run with `run-autonomous-initiative`: that skill lands every unit on `main`, and each of these projects lands on its own `project/<slug>` branch instead. So each project gets its own launch, from a Conductor workspace with nothing uncommitted:

```
/run-autonomous-project "hexframe v0: Design system" --config 4-software-engineering/1-projects/1-hexframe/.run/run.yaml
```

Between two projects:

1. Merge the finished `project/<slug>` into `main` through a pull request, once its phase-close ticket is Done.
2. In a pull request of its own, point `repo.target_branch` at the next project: `project/server-foundations`, then `project/mapping`. The run creates that branch from `main` at launch.
3. Launch the next project with its name.

Before a launch, nothing of the project should be in progress outside the run: a ticket already In Progress with a pull request into `main` would be picked up where it stands.

## Registers

The run writes to `registers/<project slug>/`, the slug being the Linear project's name in lowercase with dashes (`hexframe-v0-design-system`).

| File | An entry per |
|---|---|
| `decisions.md` | choice a unit made where its ticket left room, and that a later ticket or a human would want to know about |
| `security.md` | security finding left open when a pull request's review rounds ran out; the phase-close ticket fixes or parks it |

A register file opens with the repo's frontmatter (`title`, `parent`, `owner: diplo`, `preview`), then a one-line heading. Each entry is a `###` heading `DEC-<n>` or `SEC-<n>` and a short title, then the ticket, the pull request, and two or three sentences on what was decided or found and why.
