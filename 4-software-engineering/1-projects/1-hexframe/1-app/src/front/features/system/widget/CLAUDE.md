---
title: widget
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/front/features/system/widget
owner: diplo
preview: >-
  The tile widget on home, at the chat's foot: a new Tile's form, an edit or
  an import, as the URL holds the change under way; once a form is sent, its
  receipt, the same widget, so it takes the focus; or the export the card
  started. The Root's edit stays in the drawer. Mapping's slots read as the
  widget's kinds and places.
---
# widget

Where a Tile is written on home since HEX-102: in the chat, at the conversation's foot, on ui's tile widget (`TileWidget`, `TileImport`, `TileExport`, [[4-software-engineering/1-projects/1-hexframe/1-app/src/front/ui/chat/widgets/CLAUDE|widgets]]). The route puts `TileWidgets` under the timeline and brings the chat to the front on a phone when a form opens, comes back refused, or an export starts.

- **The form is the URL's, what follows it the page's** (`hexframe-app-design-system-v1/decisions.md#DEC-37`). Which form is open, a new Tile's in its slot, an edit or an import, is the change under way in the search params, as the drawer's was, so a link opens it and a refusal puts it back on the URL of its moment (`../state/useRefusalState.ts`). What follows a form is no change: the receipt a sent form leaves, or an export, working, then its receipt naming the zip, or failed with a retry. Home holds it (`state/useTileWidgetsState.ts`), so the card on the canvas and the chat share it. One at a time: a form opening clears it, a sent form or an export takes its place, and a receipt goes once its write is refused, so it never says done of a write that wasn't.
- **A form and its receipt are one widget.** A sent form's receipt is drawn by the same component, under the form's own key, so React keeps the one `TileWidget` and its hand-off moves the focus to the receipt. That is why a receipt carries its form's key and what the form opened on (`Session`).
- **What the user writes is a state hook, not TanStack Form** (`#DEC-39`). Mapping says what a Tile must be, through `decide`, foreseen or on the server. The widget's words and the refusal on each field are `useTileWordsState`'s, put back once per refusal turn and cleared field by field as the user changes them. The writes go through Mapping's form submits, which answer the Tile's id for the receipt.
- **The Root's edit stays in the drawer**, on the shared form (`RootDrawer`), since the widget draws a Tile's place among its parent's six and the Root has neither (`#DEC-38`).
- **A new Tile's place is Mapping's.** Its hex shows its parent's six places, free as Mapping's `freeSlot` says; another place or kind picked moves the change to that slot, the widget keyed by its parent so what the user wrote stays.

| File | Holds |
|---|---|
| `TileWidgets.tsx` | `TileWidgets`, at the conversation's foot: the form of the change under way, or its receipt while the URL still holds it; else what followed the last form, its receipt or the export; and the Root's drawer. It is where the page reads the refused writes (`useRefusalState`) and deletes from an edit |
| `forms.tsx` | `NewTileWidget` and `EditTileWidget`, each from form to receipt, on Mapping's form submits; `RootDrawer`, the Root's edit on the shared form |
| `place.ts` | The widget in Mapping's words, pure: `placeOf` and `slotOf`, a slot as a kind and a place and back; `freeFor`, the places a kind may take under a Tile; `whereIn`, where a Tile goes or stands; `slotForKind`, the slot another kind takes; `tilesBelow`, the Tiles that go along with one; `editedOf`, an edit's changed fields; `refusalOf` and `stillRefused`, a refusal on the widget's fields, cleared as they change. Tested in `place.test.ts` |

| Folder | Holds |
|---|---|
| `state/` | `useTileWordsState.ts`, what the user writes, opened on a Tile or blank, a refusal's words put back once per turn; `useTileWidgetsState.ts`, what follows a form, a receipt or the export, whose mutation it owns, an export let go running to its end; each tested beside it |

## Not wired

What HEX-100 drew that the page cannot fill yet, or that is another ticket's (`#DEC-40`): changed meanwhile, the agent's tile draft, Undo on the user's own receipt, the canvas's side for the page, a failed export's reason (its toast says it).
