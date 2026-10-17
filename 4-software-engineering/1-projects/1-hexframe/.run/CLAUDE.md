---
title: autonomous runs
parent: 4-software-engineering/1-projects/1-hexframe/.run
owner: diplo
preview: >-
  How hexframe's projects get built with nobody watching: run.yaml for the v0
  initiative, one config per project run (claude-mod, obsidian-plugin,
  mcp-server, import-export, optimistic-writes, assistant, design-system,
  tutorial, sharing), each landing on one branch I merge into main at the end, and the
  registers the runs write their decisions to.
---
# autonomous runs

An inner child of hexframe: how its projects get built by [[.skills/4-softeng/1-ship/run-autonomous-initiative/SKILL|run-autonomous-initiative]] rather than ticket by ticket. [[4-software-engineering/1-projects/1-hexframe/STACK|STACK]] says why the run lands on an initiative branch.

| File | What it holds |
|---|---|
| `run.yaml` | The v0 initiative's run config: target branch, gates, cubic as the reviewer, the `never` list, frozen and read-only paths, models |
| `claude-mod.yaml` | The run config of the "hexframe Claude Code mod" project, landing on `project/claude-mod` |
| `obsidian-plugin.yaml` | The run config of the "hexframe Obsidian plugin" project, landing on `project/obsidian-plugin` |
| `mcp-server.yaml` | The run config of the "hexframe app: MCP server" project, landing on `project/mcp-server` |
| `import-export.yaml` | The run config of the "hexframe app: Import & export" project, landing on `project/import-export` |
| `optimistic-writes.yaml` | The run config of the "hexframe app: Optimistic writes and patterns" project, landing on `project/optimistic-writes` |
| `assistant.yaml` | The run config of the "hexframe app: Assistant" project, landing on `project/assistant` |
| `design-system.yaml` | The run config of the "hexframe app: Design system v1" project, landing on `project/design-system-v1`; it halts on each proposal I haven't landed yet |
| `tutorial.yaml` | The run config of the "hexframe app: Tutorial" project, landing on `project/tutorial`; it reads the tutorial's tiles and Help's and never writes them |
| `sharing.yaml` | The run config of the "hexframe app: Sharing & organizations" project, landing on `project/sharing`; it opens no Tile to anyone its owner didn't, and gives the MCP no way to change who sees what |
| `registers/` | What the run records, one folder per project, created by the first entry |

## One run, one branch

```
/softeng:ship:run-autonomous-initiative "Hexframe v0" --config 4-software-engineering/1-projects/1-hexframe/.run/run.yaml
```

Launch it from a Conductor workspace with nothing uncommitted. The run creates `initiative/hexframe-v0` from `main`, then takes Design system, Server foundations and Mapping in that order. Every ticket is a short-lived branch off the initiative branch and lands back on it through a pull request, with CI and cubic. A project ends when its phase-close ticket is done and the root has re-run the phase gates on the initiative branch; the next one starts from there. No branch exists per project.

The one review that is mine is the final merge: once Mapping's phase-close ticket is done, I merge `initiative/hexframe-v0` into `main` through a pull request. The run never touches `main`, and a fix I land on `main` mid-run (a skill, `cubic.yaml`) reaches the run only if I merge `main` into the initiative branch.

Before a launch, nothing of these projects should be in progress outside the run: a ticket with a pull request open into `main` stops it.

## Project runs

The configs beside `run.yaml` run one project each with [[.skills/4-softeng/1-ship/run-autonomous-project/SKILL|run-autonomous-project]], on a project branch I merge into `main` once its phase-close ticket is done. They differ from `run.yaml` in their target, their project, and what they freeze: `1-app/` is frozen in the mod's and the plugin's, and the plugin's run may write `.obsidian/plugins/hexframe/`, `.obsidian/community-plugins.json` and `.obsidian/CLAUDE.md`; the MCP server's builds in `1-app/` and freezes the two other packages and `.obsidian/`; Import & export's builds in `1-app/` and the shape, and freezes every file of claude-mod outside its shape, the plugin and `.obsidian/`; Optimistic writes and patterns' and the Assistant's build in `1-app/` only, and freeze claude-mod whole, the plugin and `.obsidian/`; the Assistant's also keeps every test and gate off Blaxel and Anthropic, on the fakes.

The plugin builds on the shared shape the mod's project extracts, so the order is fixed:

```
/softeng:ship:run-autonomous-project "hexframe Claude Code mod" --config 4-software-engineering/1-projects/1-hexframe/.run/claude-mod.yaml
# merge project/claude-mod into main
/softeng:ship:run-autonomous-project "hexframe Obsidian plugin" --config 4-software-engineering/1-projects/1-hexframe/.run/obsidian-plugin.yaml
```

The app's runs all write `1-app/` and Mapping, so they go one after the other: the MCP server's first, then Import & export's, launched once `project/mcp-server` is merged into `main`, so it is cut from a `main` that has Keys, swap and Help; then Optimistic writes and patterns', launched once `project/import-export` is merged, since every write it makes optimistic, Leaves' included, must exist first; then the Assistant's, which needs all three (the serializer, the MCP, the events after commit), launched once its notes and config (#83) are merged too.

```
/softeng:ship:run-autonomous-project "hexframe app: MCP server" --config 4-software-engineering/1-projects/1-hexframe/.run/mcp-server.yaml
# merge project/mcp-server into main
/softeng:ship:run-autonomous-project "hexframe app: Import & export" --config 4-software-engineering/1-projects/1-hexframe/.run/import-export.yaml
# merge project/import-export into main
/softeng:ship:run-autonomous-project "hexframe app: Optimistic writes and patterns" --config 4-software-engineering/1-projects/1-hexframe/.run/optimistic-writes.yaml
# merge project/optimistic-writes into main
/softeng:ship:run-autonomous-project "hexframe app: Assistant" --config 4-software-engineering/1-projects/1-hexframe/.run/assistant.yaml
# merge project/assistant into main
/softeng:ship:run-autonomous-project "hexframe app: Design system v1" --config 4-software-engineering/1-projects/1-hexframe/.run/design-system.yaml
# merge project/design-system-v1 into main, the onboarding (#131) with it
/softeng:ship:run-autonomous-project "hexframe app: Tutorial" --config 4-software-engineering/1-projects/1-hexframe/.run/tutorial.yaml
# merge project/tutorial into main
/softeng:ship:run-autonomous-project "hexframe app: Sharing & organizations" --config 4-software-engineering/1-projects/1-hexframe/.run/sharing.yaml
```

Design system v1's run is the one that stops for me on purpose. Half its tickets are proposals ("Propose …"), drawn with me in `ui/` and reviewed on their pull request's preview; its never list forbids the run to implement one. It builds in `blockedBy` order and halts on the first proposal that hasn't landed. I land that proposal with do-ticket, a pull request into `project/design-system-v1`, then resume with `--resume`, which skips it as landed. Its run writes `1-app/` and may delete `4-software-engineering/1-projects/3-design-system/` (HEX-112), editing the three files that point at it, and freezes claude-mod, the plugin and `.obsidian/` as the Assistant's does.

Sharing & organizations' run waits for `project/tutorial` to be merged into `main`, since it moves Help and the tutorial under the Hexframe Organization. It writes `1-app/` only, freezes what the Tutorial's run freezes, reads Help's and the tutorial's tiles without writing them, and its never list keeps every Tile closed to anyone its owner didn't open it to, Grants and Organizations out of reach of a Key or an agent, and membership read fresh on every request.

## Registers

The run writes to `registers/<project slug>/`, the slug being the Linear project's name in lowercase with dashes (`hexframe-v0-design-system`).

| File | An entry per |
|---|---|
| `decisions.md` | choice a unit made where its ticket left room, and that a later ticket or a human would want to know about |

A register file opens with the repo's frontmatter (`title`, `parent`, `owner: diplo`, `preview`), then a one-line heading. Each entry is a `###` heading `DEC-<n>` and a short title, then the ticket, the pull request, and two or three sentences on what was decided and why.
