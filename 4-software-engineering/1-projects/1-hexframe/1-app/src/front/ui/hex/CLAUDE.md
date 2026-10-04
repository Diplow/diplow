---
title: hex
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/front/ui/hex
owner: diplo
preview: >-
  The hex canvas: one SVG, every hex a polygon, text as HTML in a
  foreignObject. Pure geometry, layout and view state below, then Tile, Frame
  and Canvas on top. The view (center, expansions, Context) lives in the URL.
---
# hex

The canvas a System is seen through. HEX-9 picked SVG: one `<svg>` whose viewBox is the canvas's own coordinates, every hex a `<polygon>` with a real stroke, and the text as HTML inside a `<foreignObject>`, so it wraps like the rest of the page. The page sizes the `<svg>` with CSS and everything inside scales with it.

| Path | Holds |
|---|---|
| `geometry/` | `geometry.ts`, pointy-top hexes, their neighbors and a Frame's seven slots; `layout.ts`, which turns a centered Tile and what is open into a flat list of placements, frames first, each with a stable `key`. Pure and tested |
| `view/` | `view.ts`, the view state as the URL carries it: `CanvasView` (`center`, `expanded`, `context`), an Effect Schema whose fields each fall back to their default, read from the search params, resolved against a System (`findTile`, and `pathTo` for a Tile's ancestors), and changed by `toggleExpanded`, `toggleContext` and `centerOn`, which return the next view in its shortest form; `orDefault`, `readSearch` and `TileId`, which a page's own search params reuse. Pure and tested |
| `Canvas.tsx` | `Canvas`: takes the System's root, the `view` and `onViewChange`, lays the placements out and draws them; with `emptySlots`, what a click on an empty slot does and how it is named |
| `Tile.tsx`, `Frame.tsx` | `Tile`, a button with its title always and its preview when there is room, and a hover card with both in full; `Frame`, the hex behind a Frame's ring, and `EmptySlot`, inert, or a button with a plus when the caller gives it an action |
| `keys.ts` | `buttonKeys`, the keys of a shape that stands for a button, shared by `Tile` and `EmptySlot`: Enter acts going down, once per press; Space acts coming up, and going down only keeps the page from scrolling |
| `look.tsx` | Colours from theme tokens (`--context` for the Context's teal), the stroke, and the label's type scale |
| `fixtures.ts` | The System `/dev/hex` and `/dev/system` draw, the top of this vault, and the views `/dev/hex` links to |

## Rules

- **The view belongs to the URL, not to the canvas.** `Canvas` holds no view state: a click calls `onViewChange` with the next view, and the route navigates to it. `readCanvasView` is the route's `validateSearch`.
- **What is Mapping and what is not.** Tiles, Children, Directions and Context are Mapping's words (STACK.md); centering, expanding and showing the Context are view state, and live here.
- **Gestures.** A click, Enter or Space expands a Child, collapses an expanded one, shows or hides the center's Context, or centers a Context Tile, which has nothing to expand. A double-click or Shift+Enter centers any Tile. `tileAction` decides which, from the placement.
- **An empty slot is the caller's to use.** The canvas knows the Tile it belongs to, its ring and its Direction; what a click there does (add a Tile, move one there) and its accessible name come from `emptySlots`, as a view change comes from `onViewChange`. Without it, empty slots stay inert, as on `/dev/hex`.
- **A Child keeps its key** when it expands into the hub of its Frame, so keyboard focus stays on it. A Context Tile, which may be a Reference to a Tile drawn elsewhere, is keyed by its slot.
- **Colour is a token**, as everywhere in `ui/`: fills and strokes are `var(--token)` or a `color-mix` of two.

## Later

With Import & export, Mapping gains Leaves beside Branches ([[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/mapping/CLAUDE|mapping]], "Later"), and `geometry/layout.ts` gives way to the shape's `layoutView` (`2-claude-mod/hooks/shape/layout.ts`), imported by relative path: this folder is the one place in the app that may import it. `view/view.ts` keeps its own schema behind the routes' `validateSearch`, extended with what the shape's layout needs: the center, its Frame kind (Children, Branches, Leaves), its inner ring (Leaves or Context), expansions by Direction, two generations deep. When a Tile's Branches and Leaves are six or fewer in all, they show as one ring of Children laid out as the [[4-software-engineering/1-projects/1-hexframe/2-claude-mod/hooks/shape/CLAUDE|shape]] lays it, a Leaf numbered as the Branch in its Direction shown as a clash. A Leaf can be centered and is offered no expansion; nothing is offered an expansion it can't have. Mapping keeps its own types: one adapter in this folder turns a System and that view state into `layoutView`'s input, and the shape's `Direction`, `Tile` and `Frame` go no further than it.
