---
title: obsidian-plugin
parent: 4-software-engineering/1-projects/1-hexframe/3-obsidian-plugin
owner: diplo
preview: >-
  @hexframe/obsidian-plugin, the Obsidian plugin with id hexframe: it will show a
  folder of the vault as a hexframe, with the clicked tile's note in a pane
  beside it. For now a plugin Obsidian loads that does nothing yet, bundled by
  esbuild, checked like the other packages, developed in a worktree opened as a
  second vault.
---
# obsidian-plugin

`@hexframe/obsidian-plugin`, an [Obsidian plugin](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin) with the id `hexframe`. It will show a folder of the vault as a hexframe inside Obsidian, reading it through the [[4-software-engineering/1-projects/1-hexframe/2-claude-mod/hooks/shape/CLAUDE|shape]] at the depth [[4-software-engineering/1-projects/1-hexframe/STACK#A vault as a hexframe|STACK]] gives it: 2. For now it loads and does nothing. Desktop only (`isDesktopOnly`) until it reads only through the vault API.

## Develop it

Open the Conductor worktree as a second vault: its `.obsidian/` is the repo's, so it carries the same config. Then, from this folder:

```bash
pnpm dev                                  # into this worktree's .obsidian/plugins/hexframe/
HEXFRAME_VAULT=~/notes/perso pnpm dev     # into another vault's
```

`dev` bundles `src/main.ts` with an inline source map, copies `manifest.json` beside it, drops a `.hotreload` file there, and rebuilds on every change. Install the [Hot Reload](https://github.com/pjeby/hot-reload) community plugin in that vault and enable Hexframe once: Hot Reload then reloads the plugin each time `main.js` changes.

That vault's config is the repo's, tracked by git. Enabling the two plugins writes their ids into `.obsidian/community-plugins.json`, installing Hot Reload adds `.obsidian/plugins/hot-reload/`, and Obsidian may touch the other files of `.obsidian/` as it runs. None of it belongs in a commit: before committing, `git status -- :/.obsidian` should list nothing you did not mean to ship, and `git restore` puts a tracked file back.

## Scripts

| Script | Does |
|---|---|
| `dev` | The watch build above |
| `build` | The production build, minified, into `dist/` (ignored by git) |
| `check` | Type-checks, then ESLint, knip and Prettier |
| `test` | Vitest, once |

The lint set is [[4-software-engineering/1-projects/1-hexframe/1-app/CLAUDE#Lint|1-app's]], minus what only the app has (dependency-cruiser's layers, the rule of 6 inside `src/`): `typescript-eslint` strict type-checked, sonarjs' cognitive complexity at most 15, the same function, parameter and file sizes, a `-- reason` on every disable, knip for dead code (its entry, `src/main.ts`, is in `package.json`, since only esbuild reaches it), and Prettier with the same config.

## Layout

| Path | Holds |
|---|---|
| `manifest.json` | The plugin's manifest, copied beside `main.js` by every build |
| `src/main.ts` | The plugin's entry, bundled into `main.js` |
| `scripts/build.ts` | `dev` and `build`: picks the folder and the mode, then bundles |
| `scripts/bundle.ts` | The esbuild bundle. Obsidian provides `obsidian`, `electron`, CodeMirror, Lezer and Node's own modules at runtime, so they stay out of it |
| `scripts/plugin-dir.ts` | Which vault `dev` writes into |

Each script's test sits beside it; `bundle.test.ts` builds into a temporary folder.

The `obsidian` typings are pinned to the app's API version, without a range: a newer one may type an API the installed app lacks. `minAppVersion` in `manifest.json` follows them.
