---
title: autonomous runs
parent: 4-software-engineering/1-projects/1-hexframe/.run
owner: diplo
preview: >-
  How hexframe v0 gets built with nobody watching: run.yaml, the config
  run-autonomous-initiative reads, every ticket landing on one initiative
  branch I merge into main at the end, and the registers the run writes its
  decisions to.
---
# autonomous runs

An inner child of hexframe: how its projects get built by [[.skills/4-softeng/1-ship/run-autonomous-initiative/SKILL|run-autonomous-initiative]] rather than ticket by ticket. [[4-software-engineering/1-projects/1-hexframe/STACK|STACK]] says why the run lands on an initiative branch.

| File | What it holds |
|---|---|
| `run.yaml` | The run config: target branch, gates, cubic as the reviewer, the `never` list, frozen and read-only paths, models |
| `registers/` | What the run records, one folder per project, created by the first entry |

## One run, one branch

```
/softeng:ship:run-autonomous-initiative "Hexframe v0" --config 4-software-engineering/1-projects/1-hexframe/.run/run.yaml
```

Launch it from a Conductor workspace with nothing uncommitted. The run creates `initiative/hexframe-v0` from `main`, then takes Design system, Server foundations and Mapping in that order. Every ticket is a short-lived branch off the initiative branch and lands back on it through a pull request, with CI and cubic. A project ends when its phase-close ticket is done and the root has re-run the phase gates on the initiative branch; the next one starts from there. No branch exists per project.

The one review that is mine is the final merge: once Mapping's phase-close ticket is done, I merge `initiative/hexframe-v0` into `main` through a pull request. The run never touches `main`, and a fix I land on `main` mid-run (a skill, `cubic.yaml`) reaches the run only if I merge `main` into the initiative branch.

Before a launch, nothing of these projects should be in progress outside the run: a ticket with a pull request open into `main` stops it.

## Registers

The run writes to `registers/<project slug>/`, the slug being the Linear project's name in lowercase with dashes (`hexframe-v0-design-system`).

| File | An entry per |
|---|---|
| `decisions.md` | choice a unit made where its ticket left room, and that a later ticket or a human would want to know about |

A register file opens with the repo's frontmatter (`title`, `parent`, `owner: diplo`, `preview`), then a one-line heading. Each entry is a `###` heading `DEC-<n>` and a short title, then the ticket, the pull request, and two or three sentences on what was decided and why.
