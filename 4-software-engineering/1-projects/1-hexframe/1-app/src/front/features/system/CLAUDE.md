---
title: system
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/front/features/system
owner: diplo
preview: >-
  The signed-in Account's System, on the canvas, and what the user does to it:
  a click on an empty slot adds a Tile there or imports files into it, an empty
  System imports a vault as its Root, and the centered Tile is edited, moved,
  swapped, exported or deleted. The view and the change under way live in the URL.
---
# system

What home shows: the user's own System, read whole through `useSystem` (`front/client/mapping/queries.ts`, [[4-software-engineering/1-projects/1-hexframe/1-app/src/front/CLAUDE|front]]), drawn by the canvas, and changed from it. The route composes it with the breadcrumb, and passes both the System's Tiles as the canvas draws them.

- **Create**: a click on an empty slot, in a Frame or in the centered Tile's Context, opens the new Tile's form for that slot; the drawer offers **New tile** or **Import here**, the same slot either way.
- **Import**: into an empty slot, a zip, a folder, picked or dropped, or one file, the only thing a Leaf slot takes; into an empty System, its untitled Root with nothing below, a vault, from **Import a vault** on the Root's card, and it becomes the Root. The browser leaves out what Mapping's reading would and says before sending what the server would refuse; the drawer then reports the Tiles created and every file left out or skipped, and why, or, refused, every fault on its path, nothing written.
- **Edit, move, export, delete** act on the centered Tile, from the card beside the canvas. Export saves the Tile and everything below it as `<slug>.zip`, the whole System from the Root. The Root is the user, so it is only edited and exported. A move is a mode: the next empty slot clicked, anywhere the canvas is taken meanwhile, is where the Tile goes. Meanwhile every other Tile drawn where it stands offers "Swap with ⟨Title⟩" on a small button at the foot of its hex, and the two trade places; the Root, a Reference and a broken one offer nothing, and the Tile's own click still opens and centers it. A refusal leaves the move under way, as a move's does. A delete asks first, then centers the Tile it stood under.
- **Errors take their channel**: a refusal on a form's field (`TitleMissing`, `PreviewTooLong`) shows under that field, an import's (`ImportRefused`, on its files) in its drawer; any other (`MovedUnderItself`, `DirectionTaken`, `TileNotFound`, `RootFixed`) shows in a toast. Nothing here catches one.

| File | Holds |
|---|---|
| `tree.ts` | `canvasTree`, the System as the canvas draws it: the Branches as its Children, Leaves not drawn until M4 (HEX-60), the Context keyed by Direction, a Reference drawn as its Tile under that Tile's id, marked so a search for the id reaches the Tile itself, a broken one as broken, the untitled Root as untitled; `tileIn`, a Tile and the one it stands under, a Branch or a Context Tile, never a Leaf yet; `isEmptySystem`, an untitled Root with nothing below it, the one System an import replaces the Root of; `slotOf`, a slot as Mapping names it, and `ringOf`, the ring a slot stands in; `swapsWith`, whether a Tile on the canvas offers to swap with the moving one, read against the System so a Reference, broken or not, offers none. Pure and tested |
| `search.ts` | The page's search params: the canvas's view, then the change under way (`add` and `slot`, `import` and `slot`, or `import=root` for an empty System's Root, `edit`, `move`), each field falling back on its own; `changeOf`, `withView`, `withChange`, and `withoutTile`, which ends a change that named a deleted Tile or one below it; `SearchChange`, the next search params or, for a write that settles later, how to make them from the search params of that moment. Pure and tested |
| `System.tsx` | `System`: the canvas, whose empty slots add a Tile or, while one is moving, move it there, and whose Tiles then offer to swap with it, one write at a time, and the banner of a move under way |
| `TileActions.tsx` | `TileActions`: the centered Tile's card, with its edit, move, export and delete, and an empty System's import of a vault, and the drawer holding a new Tile's form, an import, or an existing Tile's, an empty slot's offering both a new Tile and an import |

| Folder | Holds |
|---|---|
| `import/` | `Import`, an import in its drawer: a drop zone and its pickers, a folder's left out where a slot takes one file alone, then the report or the refusal, each a list of paths and why. Its state is `state/useImportState.ts`'s: what the place takes, the phase (`choosing`, `importing`, `landed`, `refused`), every line of the report in the page's language, and the actions the pickers and the drop call, over `useImportTiles`; `state/useImportState.test.ts`, over a stand-in for the server function |

## Rules

- **The change under way belongs to the URL**, like the view: a link opens the same form, or the same move. It holds one change at most; `withChange` replaces it, a view change keeps it, and so does a delete, unless the change named the deleted Tile or one below it. What a write does to the URL once it settles applies to the URL of that moment, not the one it was sent from.
- **The form speaks Mapping's words**: a Title, a Preview, a Body. An edit sends only the fields that changed, so the Root's Body can be written before its name.
