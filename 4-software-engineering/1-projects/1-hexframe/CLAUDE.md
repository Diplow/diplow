---
title: hexframe
parent: 4-software-engineering/1-projects/1-hexframe
owner: diplo
preview: >-
  Hexframe, the app that defines and organizes contents as hexframes, as a pnpm
  monorepo: each package is a numbered child of this node. Empty for now.
---
# hexframe

The app that defines and organizes contents as hexframes. It is a pnpm monorepo; each package is a numbered child of this node (`1-<name>/`, `2-<name>/`, …). No package exists yet.

## Rules

- **Same script names everywhere.** Every package exposes the scripts it supports among `dev`, `build`, `check` and `test`; `pnpm <script>` here runs it in every package that has it.
- **One lockfile.** Install from this folder (`pnpm install`); pnpm and Node versions are pinned in `package.json`.
- **Package names** are `@hexframe/<package>`.

Conductor runs `pnpm install` here when it creates a workspace (`.conductor/settings.toml` at the repo root). Obsidian ignores `node_modules/`.
