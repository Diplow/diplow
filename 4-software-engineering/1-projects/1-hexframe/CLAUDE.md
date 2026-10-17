---
title: hexframe
parent: 4-software-engineering/1-projects/1-hexframe
owner: diplo
preview: >-
  Hexframe, the app where a user lays out a system as a hierarchy of tiles, so
  an agent can unfold its work there, goal first, and the user keep up with it
  at the altitude they choose. A pnpm monorepo, each package a numbered child:
  1-app, 2-claude-mod, 3-obsidian-plugin. STACK.md holds the stack, the rules
  and the domains' language.
---
# hexframe

The app where a user lays out a system (a codebase, a team, their own life) as a hierarchy of tiles: one tile, the six it breaks into, then theirs. What they choose to show first carries their intent, and an AI reading the system in that order works along it.

## Why

Agents now do more than we can follow. What is left to us is to say what we want, and to keep up with what they do. Hexframe does both on the same hierarchy, read both ways: the user lays out their intent, what matters most first, and the agent works along it; the agent **unfolds** its work, its goal first, then how it means to reach it, then how each part works, and the user follows it as far down as they care to go.

The bet is that this hierarchy is not a filing system. Six at most at every level, it keeps asking the questions anyone maintaining a large system with AI should ask: what matters most here, and what is the smallest idea that would make the whole work better? Each level is an **altitude**, and so is every change: the level it moves, and the ones it leaves alone. Reviewing a pull request as what it changes in the hierarchy, and what it does not, is where this leads; it is not built yet.

The space theme follows from it: going down a level is getting closer, the user's root is the sun the rest turns around. And this vault is the first system kept that way: its six folders and six files at every level are the rule of six applied to a life, explored and maintained through hexframe.

It is a pnpm monorepo; each package is a numbered child of this node (`1-<name>/`, `2-<name>/`, …).

| # | Package | What it is |
|---|---|---|
| 1 | [[4-software-engineering/1-projects/1-hexframe/1-app/CLAUDE\|app]] | `@hexframe/app`, the TanStack Start app holding client and server, deployed to Vercel |
| 2 | [[4-software-engineering/1-projects/1-hexframe/2-claude-mod/CLAUDE\|claude-mod]] | `@hexframe/claude-mod`, a Claude Code mod: `/hexframe` shows a folder of this vault as a hexframe, in the terminal or the Desktop app |
| 3 | [[4-software-engineering/1-projects/1-hexframe/3-obsidian-plugin/CLAUDE\|obsidian-plugin]] | `@hexframe/obsidian-plugin`, the Obsidian plugin `hexframe`: a `*.hexframe` file shows a folder of this vault as a hexframe inside Obsidian |

| Inner child | What it holds |
|---|---|
| [[4-software-engineering/1-projects/1-hexframe/.cubic/CLAUDE\|.cubic]] | The briefs of cubic's three review agents (maintainability, domain design, security), wired in by `cubic.yaml` at the repo root |
| [[4-software-engineering/1-projects/1-hexframe/.run/CLAUDE\|.run]] | `run.yaml`, the config of the autonomous run that builds hexframe v0 on one initiative branch, and the registers it writes |

| File | What it holds |
|---|---|
| [[4-software-engineering/1-projects/1-hexframe/STACK\|STACK]] | The technical choices, the rules that come with them, the language of each domain, and how a vault reads as a hexframe. Read it before adding code |

## Rules

- **Same script names everywhere.** Every package exposes the scripts it supports among `dev`, `build`, `check` and `test`; `pnpm <script>` here runs it in every package that has it.
- **One lockfile.** Install from this folder (`pnpm install`); pnpm and Node versions are pinned in `package.json`.
- **Package names** are `@hexframe/<package>`.

Conductor runs `pnpm install` here when it creates a workspace (`.conductor/settings.toml` at the repo root). Obsidian ignores `node_modules/`.

Each pull request that touches this folder runs `check` and `test` in CI (`.github/workflows/hexframe.yml` at the repo root) and gets a Vercel preview.
