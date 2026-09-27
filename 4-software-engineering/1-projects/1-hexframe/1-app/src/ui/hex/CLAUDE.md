---
title: hex
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/ui/hex
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
| `view/` | `view.ts`, the view state as the URL carries it: `CanvasView` (`center`, `expanded`, `context`), an Effect Schema whose fields each fall back to their default, read from the search params, resolved against a System (`findTile`, and `pathTo` for a Tile's ancestors), and changed by `toggleExpanded`, `toggleContext` and `centerOn`, which return the next view in its shortest form. Pure and tested |
| `Canvas.tsx` | `Canvas`: takes the System's root, the `view` and `onViewChange`, lays the placements out and draws them |
| `Tile.tsx`, `Frame.tsx` | `Tile`, a button with its title always and its preview when there is room, and a hover card with both in full; `Frame`, the hex behind a Frame's ring, and `EmptySlot` |
| `look.tsx` | Colours from theme tokens (`--context` for the Context's teal), the stroke, and the label's type scale |
| `fixtures.ts` | The System `/dev/hex` and `/dev/system` draw, the top of this vault, and the views `/dev/hex` links to |

## Rules

- **The view belongs to the URL, not to the canvas.** `Canvas` holds no view state: a click calls `onViewChange` with the next view, and the route navigates to it. `readCanvasView` is the route's `validateSearch`.
- **What is Mapping and what is not.** Tiles, Children, Directions and Context are Mapping's words (STACK.md); centering, expanding and showing the Context are view state, and live here.
- **Gestures.** A click, Enter or Space expands a Child, collapses an expanded one, shows or hides the center's Context, or centers a Context Tile, which has nothing to expand. A double-click or Shift+Enter centers any Tile. `tileAction` decides which, from the placement.
- **A Child keeps its key** when it expands into the hub of its Frame, so keyboard focus stays on it. A Context Tile, which may be a Reference to a Tile drawn elsewhere, is keyed by its slot.
- **Colour is a token**, as everywhere in `ui/`: fills and strokes are `var(--token)` or a `color-mix` of two.
