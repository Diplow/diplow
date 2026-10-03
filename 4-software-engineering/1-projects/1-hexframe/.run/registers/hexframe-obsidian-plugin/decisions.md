---
title: decisions, hexframe Obsidian plugin
parent: 4-software-engineering/1-projects/1-hexframe/.run/registers/hexframe-obsidian-plugin
owner: diplo
preview: >-
  The choices the "hexframe Obsidian plugin" run made where a ticket left room,
  one entry each, for the tickets that come after and for me.
---
# Decisions

### DEC-1 `build` writes into `dist/` until HEX-30

HEX-28. CI already builds the plugin once `3-obsidian-plugin/package.json` exists, and fails when `.obsidian/plugins/hexframe/` then differs from what is committed. Committing the build is HEX-30's work, so the scaffold's `build` writes into the package's own `dist/`, ignored by git, and leaves that folder alone: CI stays green with nothing committed there. HEX-30 points `build` at `.obsidian/plugins/hexframe/` and drops `dist/`. `dev` already writes into a vault's plugin folder, the worktree's own unless `HEXFRAME_VAULT` names another vault.

### DEC-2 The `obsidian` typings are 1.13.1, not 1.14.x

HEX-28. The ticket asked for typings pinned to the current app, which it took for 1.14.x. The app installed here runs 1.13.7, and the newest `obsidian` package on npm is 1.13.1, so the typings are pinned to exactly that, and `minAppVersion` follows them: the plugin types no API the app lacks.
