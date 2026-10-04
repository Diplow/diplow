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

Open a `*.hexframe` file, such as `diplow.hexframe` at the vault's root: the view shows the file's folder, its Tile in the middle, its Children around it (its Branches past six Branches and Leaves) and its Context inside its hex, in the theme's colors, light and dark, each kind of hex in its own fill. It draws again when a file or folder it shows is created, deleted, renamed or modified. Obsidian sends no event for a dot folder, so those, `.hexframe/exclusions.yaml` among them, are read again on each drawing, and coming back to the view draws it again. It reads nothing whose real path leaves the vault, a file under a symlinked folder included, and shows no folder that does, the file's own included. Under the drawing, a line says what it left aside: a broken `exclusions.yaml`, a Leaf that clashes with a Branch, a ring that shows as a list and what would draw it as hexes, a center it can't show.

The center opens twice: an **outer** ring around its hex, full size, of Children, Branches or Leaves, and an **inner** ring inside its hex, of Leaves or Context, never the same kind twice. The pairs a view shows are Branches and Leaves, Branches and Context, Leaves and Context, and Children and Context. Each Branch of the outer ring opens on its own into any Frame kind its folder offers, drawn inside its hex, the third scale; the inner ring's hexes don't open. Collapsing peels the outer ring, then the inner one, and a collapsed center fills the view with its Title and Preview.

A ring that overflows, where a candidate found no direction, shows as a list of its candidates' names, folders with a trailing `/`, and only that ring does. Inside the hex opened into it (the center's for its inner ring, an opened Branch's, a collapsed center's), the list sits under the hex's title, one name per line, when the names fit: six in a hex of the first scale, ten in a collapsed center. Past that, the hex says how many of which kind, such as "7 Leaves, too many to draw", and a click on that line, or "Show the list" (`S`) on the hex, opens the list to fill the view, with a button and `Escape` back to the hexes. When the center's outer ring overflows, the whole view is the list, the center's own hex on top of it. A name acts as its hex would: a click, a shift-click and a right click do what they do on a Branch, a Leaf or a Context folder, `Tab` reaches it after its hex, and the items' keys act on it, though it opens no ring. A list filling the view shows a "Choose six" button, which opens the settings of the folder whose ring it is, to leave out all but six: [[4-software-engineering/1-projects/1-hexframe/.run/registers/hexframe-obsidian-plugin/decisions#DEC-13 An overflowing ring as a list, what the ticket left open|DEC-13]].

A right click on a hex opens its menu, which lists only the items that apply to that hex, each with the key of its command right-aligned. Each item is an Obsidian command, bound to its key by default and rebindable in Settings → Hotkeys, and the menu shows the key it is bound to now. The keys act on the focused hex, or name of a list, outlined: Tab and shift-Tab move the focus from one to the next in the order the view draws them, and `1` to `6` move it to the hex in that direction of the ring it sits in (from the center, the ring around it, or inside it once peeled), among the hexes only, so a digit does nothing on a name. A click or a right click on a hex or a name focuses it too, and a focus whose hex is gone goes back to the center, or to the hex of a list filling the view. A command works only while a hexframe view has the focus and its item applies to the focused hex; anywhere else its key does what it did before.

| Item | Key | On | Does |
|---|---|---|---|
| Center here | `Enter` | a Branch or a Context folder, its hex or its name in a list | What a click does: centers on it and shows its note |
| Preview | `Space` | any hex but a Leaf that isn't Markdown | What a shift-click does: shows its note, the view staying where it is |
| Expand as Children, Branches, Leaves, Context | `H`, `B`, `L`, `C` | the center, a Branch around it | Opens it into that kind, when its folder offers it and it doesn't show it already |
| Collapse | `X` | the center, an opened Branch around it | Peels the center's outer ring, then its inner one; closes the Branch |
| Show the list | `S` | a hex holding a list, unless that list already fills the view | Opens the list to fill the view, as a click on its "too many to draw" line does |
| Up | `U` | the center, except at the vault root | What a click on it does: centers on the folder holding it |
| Open in default app | `O` | a Leaf that isn't Markdown | What a click on it does: hands it to the system, under the rule below |
| Exclude from the six | `E` | any hex but the center, and any name of a list | Leaves it out of the folder holding it, written to that folder's `.hexframe/exclusions.yaml` at once, with a notice saying so |
| Hexframe settings | `,` | any hex, and any name of a list | Opens the settings of the center's folder, below |

"Expand as" on the center opens the next ring: a collapsed center opens its inner ring (Leaves or Context), a peeled one its outer ring around it (Children, Branches or Leaves), or switches its inner ring when the kind only sits inside. On an open center it switches the ring that can take the kind, the inner one first, so Leaves go inside Branches; switching the outer ring closes the Branches opened in it. A kind that would make a pair no view shows, or that the folder lacks, is not listed and its key does nothing.

A click on a hex moves the view and shows the hex's note in a pane split off to the right of it, the paired pane, in reading view (the usual toggle still switches it to editing). The view keeps that one pane and reuses it on every click, and splits a new one once the user has closed it:

| Click on | Moves the view | Shows |
|---|---|---|
| a Branch or a Context folder, an opened Branch's own included | onto it | its `CLAUDE.md`, or `-CLAUDE.md` |
| the center | up, onto the folder holding it; at the vault root, nowhere | that folder's note |
| a Markdown Leaf | nowhere | the Leaf |
| a Leaf that isn't Markdown | nowhere | nothing: Obsidian's "Open in default app" hands it to the system when it is a document the system opens rather than runs (a PDF, an image, a sound, a video, a plain text file; no office file, whose app runs what it carries), by its name and its real one |
| any hex, shift held | nowhere | the hex's note, as above |

A folder with no note opens nothing and still centers, and so does one whose note Obsidian doesn't index, which is the case inside a dot folder unless a plugin such as Hidden folders access indexes it. The view opens nothing, and centers on nothing, whose real path leaves the vault, and says why in a notice.

Reading takes the view along the other way. When the paired pane opens a folder's `CLAUDE.md` or `-CLAUDE.md`, by a wikilink followed in it, the back button or the quick switcher, the view centers on that folder as a click on its hex would, held to the vault the same way. Any other file opened there, and any file opened in another pane, leaves the view where it is. So does the note the view last dealt with there, opening again as the user comes back to the pane: one the view showed itself, since its click already chose where to center, shift held or not, or one it already followed, or refused with a notice, which it says once. Once the pane has opened another note, going back to that one follows it again.

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

The view reads the file on open and writes it only when its state changes: when a click centers it or the paired pane takes it along, when the center, or a folder holding it, is renamed, and when an item opens or collapses a ring. It then sets the fields that changed, `center` or `expansions`, and keeps the rest of the file as written. A file that isn't JSON, or a field that is malformed, gives the defaults with a line saying so, and the file stays as it is.

## Settings

A button with a gear floats in the top right of the view and opens the settings of the center's folder, as "Hexframe settings" (`,`) does; a list's "Choose six" opens them for the folder whose ring it is. They list every candidate of each kind, Branches, Leaves and Context folders, with a checkbox ticked when the folder leaves it out and a count of each kind against six that follows the ticks, saying when its ring shows as a list and when Branches and Leaves draw together as Children. One that a glob leaves out stays ticked, can't be unticked, and names the glob; the items that name nothing listed, globs among them, are named under the lists and kept. Save writes what changed to the folder's `.hexframe/exclusions.yaml`, making `.hexframe/` when missing, and the view draws again, since Obsidian sends no event for a dot folder.

That file is the plugin's one write beside the hexframe file. It changes only the lines of the items the user ticked or unticked, and keeps the rest as written, comments, globs and their order included; a flow list becomes a block list. A file it can't parse is never written over: the settings say why and offer nothing to save, and "Exclude from the six" says so in a notice. It writes only where the view may center, into a `.hexframe/` and an `exclusions.yaml` that sit at their own paths, never through a symlink, and reads the file again just before writing: [[4-software-engineering/1-projects/1-hexframe/.run/registers/hexframe-obsidian-plugin/decisions#DEC-14 The settings panel, what the ticket left open|DEC-14]].

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
| `src/main.ts` | The plugin's entry, bundled into `main.js`: binds the `hexframe` extension to the view, and adds the commands `menu.ts` makes of the items, run on the hexframe view that has the focus |
| `src/view.ts` | The view, a `TextFileView` over the hexframe file: decodes it, picks the center, reads it and the Branches it opens and draws them, follows the vault's events, carries out a click, opens a list to fill the view and back, opens the menu and runs its items and their commands, opens the settings and draws again after a save, moves the focus on Tab and the digits, keeps the paired pane and follows the folder notes opened in it. The only file that holds Obsidian state, but for the settings panel's own |
| `src/settings.ts` | The settings: the panel, an Obsidian `Modal` over a folder's exclusions, holding the ticks until Save; "Exclude from the six" written at once; and the gear button that opens the panel |
| `src/exclusions.ts` | What the settings make of a folder's exclusions: every candidate of each kind, whether an item names it or a glob leaves it out, a tick added or removed, each kind's count against six, and the file written back with the change, the rest of it kept. Pure |
| `src/click.ts` | What a click on a hex, or a name of a list, asks: the folder to center on, and the notes to show or the file to hand to the default app; and which hexes are the Branches around the center, the ones the menu opens. Pure |
| `src/follow.ts` | Which opens in the paired pane move the view, and onto which folder: a folder's note, in that pane, other than the note the view dealt with last there (one it showed, followed or refused) or the center's own; and that last note, kept from one open to the next. Pure |
| `src/expansions.ts` | How the view opens what it shows: the pairs the center's two rings may form, enforced by their type and one function, the moves between them (collapse, expand the center as a kind, open or close a Branch), what a folder makes of them, and the view the shape lays out. Pure |
| `src/menu.ts` | The menu's items in one table, each with its default key and what it asks of the view on a hex (what a click would, new expansions, a list to fill the view, a candidate to leave out, or the settings to open), or nothing where it doesn't apply, a move that changes nothing included; and the commands they are. Pure |
| `src/focus.ts` | Which hex, or name of a list, holds the keyboard's focus, by the path of its Tile, what Tab steps through, and where Tab, shift-Tab and the digits move it. Pure |
| `src/list.ts` | An overflowing ring as a list: its names, each holding a Tile made from it so it acts as its hex, whether they fit in their hex and what it says when they don't, and which list fills the view, the center's outer ring or the one the user opened, kept while the center stays. Pure |
| `src/text.ts` | How words are set in a hex: the SVG's scale, the text styles sized to a hex's radius, lines wrapped to its band, and how many names a list holds in it. Pure |
| `src/view-state.ts` | The hexframe file's JSON: its decoding with defaults, the center it names and the expansions, the fields that changed written back, a rename followed, which changes touch the view. Pure |
| `src/draw.ts` | The drawing: the shape's layout as SVG through Obsidian's `createSvg`, an opened hex as the ground of the Frame over it, a hex holding a list with its names or the line that opens it, words set as `text.ts` sets them, a click and a right-click handler on each hex and name holding a Tile, the focused one outlined, a list filling the view as HTML with its "Choose six", and the lines under it about every ring shown |
| `src/vault/frame.ts` | A folder read as a Frame through the shape, over a `Disk` port, held to the shape's rules on what a medium reads; which center to show, the file's own folder checked as much as the state's, a Branch to open checked as a center is, and the kinds closed ones offer, read side by side; whether a clicked file may be opened, by Obsidian or by the system; and a folder's settings read where the panel may write them, and a change saved there through a `Write` port. Pure but for the ports |
| `src/vault/disk.ts` | The `Disk` over Obsidian: Branches and Leaves from the vault's index, dot folders from its adapter, real paths from Node, and each read made by the real path just checked; and the `Write` over the adapter, making the folder when missing |
| `scripts/build.ts` | `dev` and `build`: picks the folder and the mode, then bundles |
| `scripts/bundle.ts` | The esbuild bundle. Obsidian provides `obsidian`, `electron`, CodeMirror, Lezer and Node's own modules at runtime, so they stay out of it |
| `scripts/plugin-dir.ts` | Which vault each build writes into |

Each script's and module's test sits beside it; `bundle.test.ts` builds into a temporary folder, and `frame.test.ts` reads a vault held in memory. `view.ts`, `settings.ts`, `disk.ts` and the DOM half of `draw.ts` need Obsidian, so they are looked at in it, not tested.

The shape is imported from claude-mod by relative path, its `.ts` files type-checked by this package's `tsc` and bundled by esbuild: it is written in erasable syntax for that.

The `obsidian` typings are pinned to the app's API version, without a range: a newer one may type an API the installed app lacks. `minAppVersion` in `manifest.json` follows them.
