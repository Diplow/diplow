---
title: system
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/front/features/system
owner: diplo
preview: >-
  The signed-in Account's System, on the canvas, and what the user does to it:
  a click on an empty slot adds a Tile there, a Leaf in a ring of Leaves, or
  imports files into it, an empty System imports a vault as its Root, and the
  centered Tile is edited, moved, swapped, exported or deleted, a Leaf grown
  into a Branch and a bare Branch shrunk into a Leaf. The view and the change
  under way live in the URL.
---
# system

What home shows: the user's own System, read whole through `useSystem` (`front/client/mapping/queries.ts`, [[4-software-engineering/1-projects/1-hexframe/1-app/src/front/CLAUDE|front]]), drawn by the canvas, and changed from it. The route composes it with the breadcrumb, and passes both the System's Tiles as the canvas draws them.

- **Create**: a click on an empty slot opens the new Tile's form for that slot: a Branch in a ring of Children or of Branches, a Leaf in a ring of Leaves, a Context Tile in a Context ring; the drawer offers **New tile** or **Import here**, the same slot either way, and says when it is a Leaf's.
- **Import**: into an empty slot, a zip, a folder, picked or dropped, or one file, the only thing a Leaf slot takes; into an empty System, its untitled Root with nothing below, a vault, from **Import a vault** on the Root's card, and it becomes the Root. The browser leaves out what Mapping's reading would and says before sending what the server would refuse; the drawer then reports the Tiles created and every file left out or skipped, and why, or, refused, every fault on its path, nothing written.
- **Edit, move, export, delete** act on the centered Tile, from the card beside the canvas. Export saves the Tile and everything below it as `<slug>.zip`, the whole System from the Root. The Root is the user, so it is only edited and exported. A move is a mode: the next empty slot clicked, anywhere the canvas is taken meanwhile, is where the Tile goes, of its own kind: a Leaf goes to a Leaf's slot, in a ring of Children or of Leaves, a Branch to a Branch's. Meanwhile every other Tile drawn where it stands offers "Swap with ⟨Title⟩" on a small button at the foot of its hex, and the two trade places; the Root, a Leaf, a Reference and a broken one offer nothing, and the Tile's own click still opens and centers it. A refusal leaves the move under way, as a move's does. A delete asks first, then centers the Tile it stood under.
- **Grow and shrink**: a Leaf's card offers **Make it a branch**, and a Branch's with nothing below it, no Child, no Context Tile nor Reference, **Make it a leaf**; a Branch holding anything isn't offered it, nor is the Root or a Context Tile. Each is a move to the same Direction of the other kind, Mapping having no operation of its own for it; a Tile of that kind already there refuses it `DirectionTaken`, in a toast. A Leaf that isn't Markdown, one an export writes as its content alone (Mapping's `isVerbatim`, through `api/mapping/files/download.ts`), shows its Body as code on its card, under its Title, its file's name.
- **Errors take their channel**: a refusal on a form's field (`TitleMissing`, `PreviewTooLong`) shows under that field, an import's (`ImportRefused`, on its files) in its drawer; any other (`MovedUnderItself`, `DirectionTaken`, `TileNotFound`, `RootFixed`) shows in a toast. Nothing here catches one.

| File | Holds |
|---|---|
| `tree.ts` | `canvasTree`, the System as the canvas draws it: its Branches and its Leaves by Direction, each Leaf marked as one, the Context keyed by Direction, a Reference drawn as its Tile under that Tile's id, marked so a search for the id reaches the Tile itself, a broken one as broken, the untitled Root as untitled; `tileIn`, a Tile and the one it stands under, a Branch, a Leaf or a Context Tile; `isEmptySystem`, an untitled Root with nothing below it, the one System an import replaces the Root of, and `holdsNothing`, a Tile with nothing below it; `slotOf`, the slot an empty Direction stands for, as Mapping names it, by its ring and the Tile that goes there, a new one a Leaf in a ring of Leaves, a moving Leaf staying a Leaf, and none where a moving Tile would change kind; `isContextSlot`, whether a slot stands in the Context; `swapsWith`, whether a Tile on the canvas offers to swap with the moving one, read against the System so a Leaf and a Reference, broken or not, offer none. Pure and tested |
| `search.ts` | The page's search params: the canvas's view, then the change under way (`add` and `slot`, `import` and `slot`, or `import=root` for an empty System's Root, `edit`, `move`), each field falling back on its own; `changeOf`, `withView`, `withChange`, and `withoutTile`, which ends a change that named a deleted Tile or one below it; `SearchChange`, the next search params or, for a write that settles later, how to make them from the search params of that moment. Pure and tested |
| `System.tsx` | `System`: the canvas, whose empty slots add a Tile or, while one is moving, move it there, and whose Tiles then offer to swap with it, one write at a time, and the banner of a move under way |
| `TileActions.tsx` | `TileActions`: the centered Tile's card, with its edit, move, export and delete, a Leaf's grow and a bare Branch's shrink, a verbatim Leaf's Body as code, and an empty System's import of a vault, and the drawer holding a new Tile's form, an import, or an existing Tile's, an empty slot's offering both a new Tile and an import |

| Folder | Holds |
|---|---|
| `state/` | `useCenteredTileState.ts`, what the centered Tile's card shows and offers as a Child of its kind: the Body of a Leaf that isn't Markdown, as code, and `KindChange`, a Leaf's grow or a bare Branch's shrink, its label, whether it is on its way, and the move it sends, over `useMoveTile`; `useCenteredTileState.test.ts`, what is offered to which Tile, what each sends, one write at a time, and a taken Direction in a toast, over a stand-in for the server function |
| `import/` | `Import`, an import in its drawer: a drop zone and its pickers, a folder's left out where a slot takes one file alone, then the report or the refusal, each a list of paths and why. Its state is `state/useImportState.ts`'s: what the place takes, the phase (`choosing`, `importing`, `landed`, `refused`), every line of the report in the page's language, and the actions the pickers and the drop call, over `useImportTiles`; `state/useImportState.test.ts`, over a stand-in for the server function |

## Rules

- **The change under way belongs to the URL**, like the view: a link opens the same form, or the same move. It holds one change at most; `withChange` replaces it, a view change keeps it, and so does a delete, unless the change named the deleted Tile or one below it. What a write does to the URL once it settles applies to the URL of that moment, not the one it was sent from.
- **The form speaks Mapping's words**: a Title, a Preview, a Body. An edit sends only the fields that changed, so the Root's Body can be written before its name.
