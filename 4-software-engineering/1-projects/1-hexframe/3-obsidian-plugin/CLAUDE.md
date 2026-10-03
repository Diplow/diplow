---
title: obsidian-plugin
parent: 4-software-engineering/1-projects/1-hexframe/3-obsidian-plugin
owner: diplo
preview: >-
  @hexframe/obsidian-plugin, the Obsidian plugin with id hexframe: it will show a
  folder of the vault as a hexframe, with the clicked tile's note in a pane
  beside it. For now a plugin Obsidian loads that does nothing yet, bundled by
  esbuild, checked like the other packages, developed in a worktree opened as a
  second vault, its build committed into the vault's .obsidian/plugins/hexframe/.
---
# obsidian-plugin

`@hexframe/obsidian-plugin`, an [Obsidian plugin](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin) with the id `hexframe`. It will show a folder of the vault as a hexframe inside Obsidian, reading it through the [[4-software-engineering/1-projects/1-hexframe/2-claude-mod/hooks/shape/CLAUDE|shape]] at the depth [[4-software-engineering/1-projects/1-hexframe/STACK#A vault as a hexframe|STACK]] gives it: 2. For now it loads and does nothing. Desktop only (`isDesktopOnly`) until it reads only through the vault API.

## Develop it

Open the Conductor worktree as a second vault: its `.obsidian/` is the repo's, so it carries the same config. Then, from this folder:

```bash
pnpm dev                                  # into this worktree's .obsidian/plugins/hexframe/
HEXFRAME_VAULT=~/notes/perso pnpm dev     # into another vault's
```

`dev` bundles `src/main.ts` with an inline source map, copies `manifest.json` and `styles.css` beside it, drops a `.hotreload` file there, and rebuilds on every change. Install the [Hot Reload](https://github.com/pjeby/hot-reload) community plugin in that vault: Hot Reload then reloads the plugin each time `main.js` changes. In this worktree Hexframe is already enabled, since the repo's `.obsidian/community-plugins.json` lists it; in another vault, enable it once.

That vault's config is the repo's, tracked by git. Enabling Hot Reload writes its id into `.obsidian/community-plugins.json`, installing it adds `.obsidian/plugins/hot-reload/`, and Obsidian may touch the other files of `.obsidian/` as it runs. None of it belongs in a commit: before committing, `git status -- :/.obsidian` should list nothing you did not mean to ship, and `git restore -- :/.obsidian/<file>` puts a tracked file back. A `dev` build into this worktree also overwrites the committed build: run `pnpm build` before committing, which writes the production build back and removes `.hotreload`.

## Why the build is committed

`pnpm build` writes the production build, `main.js`, `manifest.json` and `styles.css`, into the vault's `.obsidian/plugins/hexframe/`, and that folder is committed:

- **Devices pull the vault and can't build it.** The vault syncs through git (Obsidian Git), and a device that pulls it has no Node toolchain or `node_modules/` to build with: it gets the plugin only if git carries it.
- **The other plugins already live there.** Git tracks every community plugin's `main.js` under `.obsidian/plugins/`; Hexframe is one more.
- **CI keeps it honest.** On every pull request that touches hexframe or that folder, `.github/workflows/hexframe.yml` runs `pnpm build` and fails when the folder then differs from what is committed. The build is deterministic for that: the same sources give the same bytes, wherever it runs from.

The alternative, CI building and committing on merge, was turned down: `main` is reached only through pull requests, so a bot's commit would need a pull request of its own.

## Scripts

| Script | Does |
|---|---|
| `dev` | The watch build above |
| `build` | The production build, minified, into the repo's `.obsidian/plugins/hexframe/`, committed (above) |
| `check` | Type-checks, then ESLint, knip and Prettier |
| `test` | Vitest, once |

The lint set is [[4-software-engineering/1-projects/1-hexframe/1-app/CLAUDE#Lint|1-app's]], minus what only the app has (dependency-cruiser's layers, the rule of 6 inside `src/`): `typescript-eslint` strict type-checked, sonarjs' cognitive complexity at most 15, the same function, parameter and file sizes, a `-- reason` on every disable, knip for dead code (its entry, `src/main.ts`, is in `package.json`, since only esbuild reaches it), and Prettier with the same config.

## Layout

| Path | Holds |
|---|---|
| `manifest.json` | The plugin's manifest, copied beside `main.js` by every build |
| `styles.css` | The plugin's styles, copied beside `main.js` by every build. Empty for now |
| `src/main.ts` | The plugin's entry, bundled into `main.js` |
| `scripts/build.ts` | `dev` and `build`: picks the folder and the mode, then bundles |
| `scripts/bundle.ts` | The esbuild bundle. Obsidian provides `obsidian`, `electron`, CodeMirror, Lezer and Node's own modules at runtime, so they stay out of it |
| `scripts/plugin-dir.ts` | Which vault each build writes into |

Each script's test sits beside it; `bundle.test.ts` builds into a temporary folder.

The `obsidian` typings are pinned to the app's API version, without a range: a newer one may type an API the installed app lacks. `minAppVersion` in `manifest.json` follows them.
