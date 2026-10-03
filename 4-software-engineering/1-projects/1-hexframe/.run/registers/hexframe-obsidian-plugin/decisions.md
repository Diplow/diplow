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

HEX-28, [#36](https://github.com/Diplow/diplow/pull/36). CI already builds the plugin once `3-obsidian-plugin/package.json` exists, and fails when `.obsidian/plugins/hexframe/` then differs from what is committed. Committing the build is HEX-30's work, so the scaffold's `build` writes into the package's own `dist/`, ignored by git, and leaves that folder alone: CI stays green with nothing committed there. HEX-30 points `build` at `.obsidian/plugins/hexframe/` and drops `dist/`. `dev` already writes into a vault's plugin folder, the worktree's own unless `HEXFRAME_VAULT` names another vault.

### DEC-2 The `obsidian` typings are 1.13.1, not 1.14.x

HEX-28, [#36](https://github.com/Diplow/diplow/pull/36). The ticket asked for typings pinned to the current app, which it took for 1.14.x. The app installed here runs 1.13.7, and the newest `obsidian` package on npm is 1.13.1, so the typings are pinned to exactly that, and `minAppVersion` follows them: the plugin types no API the app lacks.

### DEC-3 `styles.css` is a plain file copied beside `main.js`, and `build` owns its folder

HEX-30. The ticket asks `build` for `main.js`, `manifest.json` and `styles.css`, and the plugin has no styles yet. `styles.css` sits beside `manifest.json` in the package, holding one comment, and every build copies it as it is, the way it copies the manifest. A ticket that brings styles writes them there, or switches to a CSS file esbuild bundles, as long as the output keeps the name `styles.css`. DEC-1 is done: `build` writes into the repo's `.obsidian/plugins/hexframe/` and `dist/` is gone. Since `dev` writes into that same folder by default, a production build also removes the `.hotreload` a dev build leaves there, so after `pnpm build` the folder holds exactly what is committed, and CI's build-and-compare step fails on a committed `.hotreload`.
