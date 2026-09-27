---
title: Code
parent: 4-software-engineering/1-code
owner: diplo
preview: >-
  The monorepo holding every piece of software I build: pnpm workspaces, one app
  per numbered child (hexframe, site, boilerplate). New apps start as a copy of
  the boilerplate; nothing is shared between apps until a second one needs it.
---
# Code

A pnpm monorepo, and the only place in this repo where software lives. Each app is a numbered child of this node:

| # | App | What it is |
|---|---|---|
| 1 | [[1-hexframe/CLAUDE\|hexframe]] | The app that defines and organizes contents |
| 2 | [[2-site/CLAUDE\|site]] | My personal website |
| 3 | [[3-boilerplate/CLAUDE\|boilerplate]] | The template every new app starts from |

## Rules

- **Copy, don't share.** A new app starts as a copy of `3-boilerplate/` and then lives its own life. Config moves into a shared package only once a second app needs the same fix.
- **Same script names everywhere.** Every app exposes the scripts it supports among `dev`, `build`, `check` and `test`; `pnpm <script>` here runs it in every app that has it.
- **One lockfile.** Install from this folder (`pnpm install`); pnpm and Node versions are pinned in `package.json`.
- **Package names** are `@diplow/<app>`.

Conductor runs `pnpm install` here when it creates a workspace (`.conductor/settings.toml` at the repo root). Obsidian ignores `node_modules/`.
