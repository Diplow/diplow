---
title: obsidian-plugin
parent: 4-software-engineering/1-projects/1-hexframe/3-obsidian-plugin
owner: diplo
preview: >-
  @hexframe/obsidian-plugin, the Obsidian plugin with id hexframe: a *.hexframe
  file opens a view of a folder of the vault as a hexframe, its state kept in the
  file as JSON. Bundled by esbuild, checked like the other packages, developed in
  a worktree opened as a second vault, its build committed into the vault's
  .obsidian/plugins/hexframe/.
---
# obsidian-plugin

`@hexframe/obsidian-plugin`, an [Obsidian plugin](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin) with the id `hexframe`. It shows a folder of the vault as a hexframe inside Obsidian, reading it through the [[4-software-engineering/1-projects/1-hexframe/2-claude-mod/hooks/shape/CLAUDE|shape]]. [[4-software-engineering/1-projects/1-hexframe/STACK#A vault as a hexframe|STACK]] gives it depth 2; for now it draws depth 1, the center and one ring. Desktop only (`isDesktopOnly`): the real paths the shape checks every read against come from Node.

## Use it

Open a `*.hexframe` file, such as `diplow.hexframe` at the vault's root: the view shows the file's folder, its Tile in the middle and its Children around it (its Branches past six Branches and Leaves), in the theme's colors, light and dark. It draws again when a file or folder it shows is created, deleted, renamed or modified. Obsidian sends no event for a dot folder, so those, `.hexframe/exclusions.yaml` among them, are read again on each drawing, and coming back to the view draws it again. It reads nothing whose real path leaves the vault, a file under a symlinked folder included, and shows no folder that does, the file's own included. Under the drawing, a line says what it left aside: a broken `exclusions.yaml`, a Leaf that clashes with a Branch, a ring too full to draw, a center it can't show.

The file keeps the view state as JSON, what the app keeps in its URL. An empty file means the defaults:

```json
{
  "center": "4-software-engineering",
  "expansions": { "outer": "children" }
}
```

- `center`: the folder in the middle, relative to the vault; absent, the file's own folder. One that leaves the vault (an absolute path, a `..` past its root, a symlink out of it), that a folder on the way leaves out, or that isn't a folder is dropped, and the view says so and shows the file's own folder.
- `expansions.outer`: the Frame kind of the ring around the center, `children`, `branches` or `leaves`. A folder that doesn't offer it shows Children, or Branches past six.

The view reads the file on open and writes it only when its state changes, today when the center, or a folder holding it, is renamed: it then sets `center` and keeps the rest of the file as written. A file that isn't JSON, or a field that is malformed, gives the defaults with a line saying so, and the file stays as it is.

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
| `styles.css` | The plugin's styles, copied beside `main.js` by every build: the drawing's colors, all of them Obsidian's CSS variables |
| `src/main.ts` | The plugin's entry, bundled into `main.js`: binds the `hexframe` extension to the view |
| `src/view.ts` | The view, a `TextFileView` over the hexframe file: decodes it, picks the center, reads and draws it, follows the vault's events. The only file that holds Obsidian state |
| `src/view-state.ts` | The hexframe file's JSON: its decoding with defaults, the center it names, the outer Frame kind, a rename followed, which changes touch the view. Pure |
| `src/draw.ts` | The drawing: the shape's layout as SVG through Obsidian's `createSvg`, words wrapped to their hex, and the lines under it |
| `src/vault/frame.ts` | A folder read as a Frame through the shape, over a `Disk` port, held to the shape's rules on what a medium reads; and whether a center may be shown. Pure but for the port |
| `src/vault/disk.ts` | The `Disk` over Obsidian: Branches and Leaves from the vault's index, dot folders from its adapter, real paths from Node, and each read made by the real path just checked |
| `scripts/build.ts` | `dev` and `build`: picks the folder and the mode, then bundles |
| `scripts/bundle.ts` | The esbuild bundle. Obsidian provides `obsidian`, `electron`, CodeMirror, Lezer and Node's own modules at runtime, so they stay out of it |
| `scripts/plugin-dir.ts` | Which vault each build writes into |

Each script's and module's test sits beside it; `bundle.test.ts` builds into a temporary folder, and `frame.test.ts` reads a vault held in memory. `view.ts`, `disk.ts` and the DOM half of `draw.ts` need Obsidian, so they are looked at in it, not tested.

The shape is imported from claude-mod by relative path, its `.ts` files type-checked by this package's `tsc` and bundled by esbuild: it is written in erasable syntax for that.

The `obsidian` typings are pinned to the app's API version, without a range: a newer one may type an API the installed app lacks. `minAppVersion` in `manifest.json` follows them.
