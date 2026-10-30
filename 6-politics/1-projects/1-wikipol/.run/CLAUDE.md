---
title: autonomous runs
parent: 6-politics/1-projects/1-wikipol/.run
owner: diplo
preview: >-
  How wikipol's projects get built with nobody watching: one run config per
  Linear project of the Wikipol team, each landing on a project branch I merge
  into main at the end, and the registers the runs write their decisions to.
---
# autonomous runs

An inner child of wikipol: how its projects get built by [[.skills/4-softeng/1-ship/run-autonomous-project/SKILL|run-autonomous-project]] rather than ticket by ticket.

| File | What it holds |
|---|---|
| `sources-from-youtube.yaml` | The run config of the "Sources from YouTube" project, landing on `project/sources-from-youtube`; it builds and tests the pipeline and leaves every operation (Scaleway setup, backfills, launchd) to WIK-12's checklist |
| `registers/` | What the run records, one folder per project, created by the first entry |

## Launching

```
/softeng:ship:run-autonomous-project "Sources from YouTube" --config 6-politics/1-projects/1-wikipol/.run/sources-from-youtube.yaml
```

From a Conductor workspace with nothing uncommitted, once the config is on `main` and the Scaleway resources the config's header names exist, their variables in `~/.config/wikipol/.env`. The one review that is mine is the final merge of `project/sources-from-youtube` into `main`, after WIK-12.
