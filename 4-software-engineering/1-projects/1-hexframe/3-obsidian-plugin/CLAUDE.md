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

`@hexframe/obsidian-plugin`, an [Obsidian plugin](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin) with the id `hexframe`. It shows a folder of the vault as a hexframe inside Obsidian, reading it through the [[4-software-engineering/1-projects/1-hexframe/2-claude-mod/hooks/shape/CLAUDE|shape]]. It draws the depth [[4-software-engineering/1-projects/1-hexframe/STACK#A vault as a hexframe|STACK]] gives it, 2: three scales, the center opened twice and each Branch around it once. Desktop only (`isDesktopOnly`): the real paths the shape checks every read against come from Node.

## Use it

Open a `*.hexframe` file, such as `diplow.hexframe` at the vault's root: the view shows the file's folder, its Tile in the middle, its Children around it (its Branches past six Branches and Leaves) and its Context inside its hex, in the theme's colors, light and dark, each kind of hex in its own fill. It draws again when a file or folder it shows is created, deleted, renamed or modified. Obsidian sends no event for a dot folder, so those, `.hexframe/exclusions.yaml` among them, are read again on each drawing, and coming back to the view draws it again. It reads nothing whose real path leaves the vault, a file under a symlinked folder included, and shows no folder that does, the file's own included. Under the drawing, a line says what it left aside: a broken `exclusions.yaml`, a Leaf that clashes with a Branch, a ring too full to draw, a center it can't show.

The center opens twice: an **outer** ring around its hex, full size, of Children, Branches or Leaves, and an **inner** ring inside its hex, of Leaves or Context, never the same kind twice. The pairs a view shows are Branches and Leaves, Branches and Context, Leaves and Context, and Children and Context. Each Branch of the outer ring opens on its own into any Frame kind its folder offers, drawn inside its hex, the third scale; the inner ring's hexes don't open. Collapsing peels the outer ring, then the inner one, and a collapsed center fills the view with its Title and Preview. Until the view's menu comes, switching is done from its header and with alt:

| Control | Does |
|---|---|
| Collapse the center (header) | Peels the outer ring, then the inner one |
| Expand the center (header) | Opens them back: Context inside, then Children or Branches around it, Branches around Leaves |
| Switch the ring around the center (header) | The outer ring's next kind the folder offers that can sit beside the inner one |
| Switch the ring inside the center (header) | The inner ring's next kind, likewise |
| Alt-click on a Branch around the center | Opens it into the next kind its folder offers, and closes it after the last one |

A click on a hex moves the view and shows the hex's note in a pane split off to the right of it, the paired pane, in reading view (the usual toggle still switches it to editing). The view keeps that one pane and reuses it on every click, and splits a new one once the user has closed it:

| Click on | Moves the view | Shows |
|---|---|---|
| a Branch or a Context folder, an opened Branch's own included | onto it | its `CLAUDE.md`, or `-CLAUDE.md` |
| the center | up, onto the folder holding it; at the vault root, nowhere | that folder's note |
| a Markdown Leaf | nowhere | the Leaf |
| a Leaf that isn't Markdown | nowhere | nothing: Obsidian's "Open in default app" hands it to the system when it is a document the system opens rather than runs (a PDF, an image, a sound, a video, a plain text file; no office file, whose app runs what it carries), by its name and its real one |
| any hex, shift held | nowhere | the hex's note, as above |

A folder with no note opens nothing and still centers, and so does one whose note Obsidian doesn't index, which is the case inside a dot folder unless a plugin such as Hidden folders access indexes it. The view opens nothing, and centers on nothing, whose real path leaves the vault, and says why in a notice.

Reading takes the view along the other way. When the paired pane opens a folder's `CLAUDE.md` or `-CLAUDE.md`, by a wikilink followed in it, the back button or the quick switcher, the view centers on that folder as a click on its hex would, held to the vault the same way. Any other file opened there, and any file opened in another pane, leaves the view where it is. So does the note the view itself last showed there, since its click already chose where to center, shift held or not, until the pane has opened another note.

The file keeps the view state as JSON, what the app keeps in its URL. An empty file means the defaults, the file's own folder with Children (or Branches) around it and Context inside. One that sets every field:

```json
{
  "center": "4-software-engineering",
  "expansions": { "outer": "branches", "inner": "leaves", "branches": { "3": "context" } }
}
```

- `center`: the folder in the middle, relative to the vault; absent, the file's own folder. One that leaves the vault (an absolute path, a `..` past its root, a symlink out of it), that a folder on the way leaves out, or that isn't a folder is dropped, and the view says so and shows the file's own folder.
- `expansions.outer`: the Frame kind of the ring around the center, `children`, `branches` or `leaves`, or `null` once peeled. Absent, Children, or Branches beside Leaves. A folder that doesn't offer it shows Children, or Branches past six.
- `expansions.inner`: the Frame kind of the ring inside the center, `leaves` or `context`, or `null` once collapsed. Absent, Context. One the folder doesn't offer, or that can't sit beside the outer ring, shows Context; a pair the file names that no view shows keeps the outer ring, with Context inside, and a line saying so.
- `expansions.branches`: the Frame kind each Branch of the outer ring opens into, by its direction, `"1"` to `"6"`. A Branch absent from it is closed, and one whose folder doesn't offer the kind shows Children, or Branches past six. A Branch the view couldn't center on (out of the vault, left out by a folder on the way, unreadable) stays closed, with a line saying why. Centering elsewhere closes them all, since they are the old center's.

The view reads the file on open and writes it only when its state changes: when a click centers it or the paired pane takes it along, when the center, or a folder holding it, is renamed, and when an expansion is switched. It then sets the fields that changed, `center` or `expansions`, and keeps the rest of the file as written. A file that isn't JSON, or a field that is malformed, gives the defaults with a line saying so, and the file stays as it is.

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
| `src/view.ts` | The view, a `TextFileView` over the hexframe file: decodes it, picks the center, reads it and the Branches it opens and draws them, follows the vault's events, carries out a click, switches the expansions, keeps the paired pane and follows the folder notes opened in it. The only file that holds Obsidian state |
| `src/click.ts` | What a click on a hex asks: the folder to center on, and the notes to show or the file to hand to the default app; and which hexes are the Branches around the center, the ones an alt-click opens. Pure |
| `src/follow.ts` | Which opens in the paired pane move the view, and onto which folder: a folder's note, in that pane, other than the one the view itself showed there. Pure |
| `src/expansions.ts` | How the view opens what it shows: the pairs the center's two rings may form, enforced by their type and one function, the moves between them (collapse, expand, switch a ring, open a Branch), what a folder makes of them, and the view the shape lays out. Pure |
| `src/view-state.ts` | The hexframe file's JSON: its decoding with defaults, the center it names and the expansions, the fields that changed written back, a rename followed, which changes touch the view. Pure |
| `src/draw.ts` | The drawing: the shape's layout as SVG through Obsidian's `createSvg`, an opened hex as the ground of the Frame over it, words wrapped and sized to their hex, a click handler on each hex holding a Tile, and the lines under it about every ring shown |
| `src/vault/frame.ts` | A folder read as a Frame through the shape, over a `Disk` port, held to the shape's rules on what a medium reads; which center to show, the file's own folder checked as much as the state's, and a Branch to open checked as a center is; and whether a clicked file may be opened, by Obsidian or by the system. Pure but for the port |
| `src/vault/disk.ts` | The `Disk` over Obsidian: Branches and Leaves from the vault's index, dot folders from its adapter, real paths from Node, and each read made by the real path just checked |
| `scripts/build.ts` | `dev` and `build`: picks the folder and the mode, then bundles |
| `scripts/bundle.ts` | The esbuild bundle. Obsidian provides `obsidian`, `electron`, CodeMirror, Lezer and Node's own modules at runtime, so they stay out of it |
| `scripts/plugin-dir.ts` | Which vault each build writes into |

Each script's and module's test sits beside it; `bundle.test.ts` builds into a temporary folder, and `frame.test.ts` reads a vault held in memory. `view.ts`, `disk.ts` and the DOM half of `draw.ts` need Obsidian, so they are looked at in it, not tested.

The shape is imported from claude-mod by relative path, its `.ts` files type-checked by this package's `tsc` and bundled by esbuild: it is written in erasable syntax for that.

The `obsidian` typings are pinned to the app's API version, without a range: a newer one may type an API the installed app lacks. `minAppVersion` in `manifest.json` follows them.
