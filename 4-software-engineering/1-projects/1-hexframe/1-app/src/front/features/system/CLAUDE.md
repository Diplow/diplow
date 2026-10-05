---
title: system
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/front/features/system
owner: diplo
preview: >-
  The signed-in Account's System, on the canvas, and what the user does to it:
  a click on an empty slot adds a Tile there, and the centered Tile is edited,
  moved, swapped or deleted. The view and the change under way live in the URL.
---
# system

What home shows: the user's own System, read whole through `useSystem` (`front/client/mapping/queries.ts`, [[4-software-engineering/1-projects/1-hexframe/1-app/src/front/CLAUDE|front]]), drawn by the canvas, and changed from it. The route composes it with the breadcrumb, and passes both the System's Tiles as the canvas draws them.

- **Create**: a click on an empty slot, in a Frame or in the centered Tile's Context, opens the new Tile's form for that slot.
- **Edit, move, delete** act on the centered Tile, from the card beside the canvas. The Root is the user, so it is only edited. A move is a mode: the next empty slot clicked, anywhere the canvas is taken meanwhile, is where the Tile goes. Meanwhile every other Tile drawn where it stands offers "Swap with ⟨Title⟩" on a small button at the foot of its hex, and the two trade places; the Root, a Reference and a broken one offer nothing, and the Tile's own click still opens and centers it. A refusal leaves the move under way, as a move's does. A delete asks first, then centers the Tile it stood under.
- **Errors take their channel**: a refusal on a form's field (`TitleMissing`, `PreviewTooLong`) shows under that field; any other (`MovedUnderItself`, `DirectionTaken`, `TileNotFound`, `RootFixed`) shows in a toast. Nothing here catches one.

| File | Holds |
|---|---|
| `tree.ts` | `canvasTree`, the System as the canvas draws it: the Context keyed by Direction, a Reference drawn as its Tile under that Tile's id, marked so a search for the id reaches the Tile itself, a broken one as broken, the untitled Root as untitled; `tileIn`, a Tile and the one it stands under; `slotOf`, a slot as Mapping names it, and `ringOf`, the ring a slot stands in; `swapsWith`, whether a Tile on the canvas offers to swap with the moving one, read against the System so a Reference, broken or not, offers none. Pure and tested |
| `search.ts` | The page's search params: the canvas's view, then the change under way (`add` and `slot`, `edit`, `move`), each field falling back on its own; `changeOf`, `withView`, `withChange`, and `withoutTile`, which ends a change that named a deleted Tile or one below it; `SearchChange`, the next search params or, for a write that settles later, how to make them from the search params of that moment. Pure and tested |
| `System.tsx` | `System`: the canvas, whose empty slots add a Tile or, while one is moving, move it there, and whose Tiles then offer to swap with it, one write at a time, and the banner of a move under way |
| `TileActions.tsx` | `TileActions`: the centered Tile's card, with its edit, move and delete, and the drawer holding a new Tile's form or an existing Tile's |

## Rules

- **The change under way belongs to the URL**, like the view: a link opens the same form, or the same move. It holds one change at most; `withChange` replaces it, a view change keeps it, and so does a delete, unless the change named the deleted Tile or one below it. What a write does to the URL once it settles applies to the URL of that moment, not the one it was sent from.
- **The form speaks Mapping's words**: a Title, a Preview, a Body. An edit sends only the fields that changed, so the Root's Body can be written before its name.
