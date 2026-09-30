---
title: system
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/features/system
owner: diplo
preview: >-
  The signed-in Account's System, on the canvas, and what the user does to it:
  a click on an empty slot adds a Tile there, and the centered Tile is edited,
  moved or deleted. The view and the change under way live in the URL.
---
# system

What home shows: the user's own System, read whole through `useSystem` ([[4-software-engineering/1-projects/1-hexframe/1-app/src/api/domains/mapping/CLAUDE|api/domains/mapping]]), drawn by the canvas, and changed from it. The route composes it with the breadcrumb, and passes both the System's Tiles as the canvas draws them.

- **Create**: a click on an empty slot, in a Frame or in the centered Tile's Context, opens the new Tile's form for that slot.
- **Edit, move, delete** act on the centered Tile, from the card beside the canvas. The Root is the user, so it is only edited. A move is a mode: the next empty slot clicked, anywhere the canvas is taken meanwhile, is where the Tile goes. A delete asks first, then centers the Tile it stood under.
- **Errors take their channel**: a refusal on a form's field (`TitleMissing`, `PreviewTooLong`) shows under that field; any other (`MovedUnderItself`, `DirectionTaken`, `TileNotFound`) shows in a toast. Nothing here catches one.

| File | Holds |
|---|---|
| `tree.ts` | `canvasTree`, the System as the canvas draws it: the Context keyed by Direction, a Reference drawn as its Tile under that Tile's id, a broken one as broken, the untitled Root as untitled; `tileIn`, a Tile and the one it stands under; `slotOf`, a slot as Mapping names it, and `ringOf`, the ring a slot stands in. Pure and tested |
| `search.ts` | The page's search params: the canvas's view, then the change under way (`add` and `slot`, `edit`, `move`), each field falling back on its own; `changeOf`, `withView`, `withChange`, and `withoutTile`, which ends a change that named a deleted Tile. Pure and tested |
| `System.tsx` | `System`: the canvas, whose empty slots add a Tile or, while one is moving, move it there, and the banner of a move under way |
| `TileActions.tsx` | `TileActions`: the centered Tile's card, with its edit, move and delete, and the drawer holding a new Tile's form or a Tile's |

## Rules

- **The change under way belongs to the URL**, like the view: a link opens the same form, or the same move. It holds one change at most; `withChange` replaces it, a view change keeps it, and so does a delete, unless the change named the deleted Tile.
- **The form speaks Mapping's words**: a Title, a Preview, a Body. An edit sends only the fields that changed, so the Root's Body can be written before its name.
