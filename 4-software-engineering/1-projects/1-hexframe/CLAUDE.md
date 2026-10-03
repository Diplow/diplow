---
title: hexframe
parent: 4-software-engineering/1-projects/1-hexframe
owner: diplo
preview: >-
  Hexframe, the app where a user lays out a system as a hierarchy of tiles so AI
  can work along their intent. A pnpm monorepo, each package a numbered child;
  the first is 1-app. STACK.md holds the stack, the rules and the domains' language.
---
# hexframe

The app where a user lays out a system (a codebase, a team, their own life) as a hierarchy of tiles: one tile, the six it breaks into, then theirs. What they choose to show first carries their intent, and an AI reading the system in that order works along it.

It is a pnpm monorepo; each package is a numbered child of this node (`1-<name>/`, `2-<name>/`, …).

| # | Package | What it is |
|---|---|---|
| 1 | [[4-software-engineering/1-projects/1-hexframe/1-app/CLAUDE\|app]] | `@hexframe/app`, the TanStack Start app holding client and server, deployed to Vercel |
| 2 | [[4-software-engineering/1-projects/1-hexframe/2-claude-mod/CLAUDE\|claude-mod]] | `@hexframe/claude-mod`, a Claude Code mod: `/hexframe` shows a folder of this vault as a hexframe, in the terminal or the Desktop app |

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
