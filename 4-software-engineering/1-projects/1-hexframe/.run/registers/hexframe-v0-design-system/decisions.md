---
title: decisions, hexframe v0 Design system
parent: 4-software-engineering/1-projects/1-hexframe/.run/registers/hexframe-v0-design-system
owner: diplo
preview: >-
  The choices the autonomous run made while building hexframe v0's design
  system, where a ticket left room: how ui/ components take their content,
  which library backs the Drawer, a darker-theme token fix, how the hex
  canvas is driven and coloured, and where the chat and the breadcrumb live.
---
# Decisions

### DEC-1 Components take their content as props, not as parts to assemble

HEX-11, [#9](https://github.com/Diplow/diplow/pull/9). `Card`, `DropdownMenu`, `ConfirmDialog` and `DataTable` take `title`, `entries` or `columns` rather than exporting shadcn's `CardHeader`, `DropdownMenuItem` and the rest. The list is closed, and a feature that can't recombine the parts can't drift from them either. `DataTable`'s `DataColumn` also keeps TanStack Table's types out of every feature, which the import-boundary lint needs.

### DEC-2 Drawer is a Radix Dialog sliding from the right, and controlled only

HEX-11, [#9](https://github.com/Diplow/diplow/pull/9). shadcn's Drawer is built on vaul, which would be one more dependency, and it's barely maintained. A Radix Dialog does the job and keeps every overlay on Radix. `open` and `onOpenChange` are required because STACK.md puts an open drawer in the route's search params.

### DEC-3 Dark `--destructive` is brighter and gets a dark foreground

HEX-11, [#9](https://github.com/Diplow/diplow/pull/9). At `oklch(0.396 0.141 25.723)`, field errors and destructive menu entries were barely readable on the dark background. It is now `oklch(0.704 0.191 22.216)`, shadcn's current value. Its dark-theme foreground is a dark red, as success and info already had, so the destructive button sits on the solid token without shadcn's `dark:bg-destructive/60` and its label passes contrast.

### DEC-4 The canvas's gestures: click opens, double-click centers

HEX-12, [#10](https://github.com/Diplow/diplow/pull/10). The ticket asked for centering, expanding and collapsing, and the Context view, without saying which gesture does what. A click (or Enter, or Space) does the cheap, reversible thing where the Tile is: expand a Child, collapse an expanded one, show or hide the center's Context, or center a Context Tile, which has nothing to expand. A double-click, or Shift+Enter, centers any Tile. The first click of a double-click expands the Tile in place, so the second lands on the same Tile and the double-click centers it.

### DEC-5 The canvas's view state is three optional search params

HEX-12, [#10](https://github.com/Diplow/diplow/pull/10). `center` (a Tile id; absent, the root), `expanded` (the ids shown as Frames) and `context` (the center shows its Context). Every change returns the view in its shortest form: defaults left out and expansions no one can see dropped, so the root is a plain `/dev/hex` and a link carries only what is on screen. `expanded` goes through the router's default JSON encoding. The route reads them with an Effect Schema, the first use of `effect` in the app (4.0.0-rc.117, the Effect 4 RC STACK.md names): an id is a non-empty string of at most 100 characters, the list at most 100 ids, and a field that fails falls back to its default alone. The reader sets every field, `undefined` when it falls back, because the router lays a route's search over the raw one: a field left out kept the raw value, and `?expanded=5` reached the canvas.

### DEC-6 `context` is a colour token, and the fixture System is not translated

HEX-12, [#10](https://github.com/Diplow/diplow/pull/10). The prototype tinted the Context with `--chart-2`, a chart colour. It is now `--context`, which takes `--chart-2`'s value in each theme, so the canvas names what it colours. The fixture System is the user's own content, in their words, so French translates the page and the canvas's labels but not the Tiles' titles and previews, as it will be with real data.

### DEC-7 Features get their own folder and layer, between routes and the API

HEX-13. The Conversation and the breadcrumb are feature components, not `ui/`, and the app had no place for them: they live in `src/features/<feature>/`, which dependency-cruiser now reads as a layer below `routes/` and above `api/`, so a feature reaches the server through a server function like a route does. `no-feature-importing-another` makes STACK.md's sibling features, which may not import each other, a lint. The breadcrumb's path is `pathTo` in `ui/hex/view/`, beside `findTile`, which now uses it, since resolving an id against a System already lived there.

### DEC-8 The Conversation shows the reader's days and times, and `/dev/system` renders on the client

HEX-13. The timeline splits by the reader's local day ("Today", "Yesterday", then a date) and shows times in the page's language. A server in another time zone, as on Vercel, would render other days and times and fail hydration, so `/dev/system` is `ssr: false`. The real Conversation page will face the same choice once its data comes from the server. A long Preview on a tile card shows its first 140 characters, cut at a word, with "Show more": a count of characters rather than a CSS line clamp, since measuring whether a clamp cut anything would take a `useEffect`, which STACK.md keeps out of features. cubic asked for that rule to be a lint, and it now is: `eslint.config.ts` refuses an effect hook outside `src/ui/`, and `scripts/lint.test.ts` proves it fires.
