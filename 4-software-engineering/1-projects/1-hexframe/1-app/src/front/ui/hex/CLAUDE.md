---
title: hex
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/front/ui/hex
owner: diplo
preview: >-
  The hex canvas: one SVG, every hex a polygon, text as HTML in a
  foreignObject, laid out by the shape's layoutView through one adapter. Pure
  geometry and view state below, a state hook, then Tile, Frame and Canvas on
  top. The view (center, its rings, the Branches it opens) lives in the URL.
---
# hex

The canvas a System is seen through. HEX-9 picked SVG: one `<svg>` whose viewBox is the canvas's own coordinates, every hex a `<polygon>` with a real stroke, and the text as HTML inside a `<foreignObject>`, so it wraps like the rest of the page. The page sizes the `<svg>` with CSS and everything inside scales with it.

The canvas is a medium of the [[4-software-engineering/1-projects/1-hexframe/2-claude-mod/hooks/shape/CLAUDE|shape]], as claude-mod and the Obsidian plugin are: the shape's `layoutView` (`2-claude-mod/hooks/shape/layout.ts`) places its hexes, so a System lays out in the app as a vault lays out in Claude Code and in Obsidian. `geometry/shape.ts` is the one module of the app that imports it, by relative path (dependency-cruiser): it turns the System and the view into the shape's Frames, a Tile's id standing in for a folder's path, and answers in the canvas's own words. The shape's `Direction`, `Tile`, `Frame` and `Placement` go no further than it.

| Path | Holds |
|---|---|
| `geometry/` | `geometry.ts`, pointy-top hexes, their neighbors and the box a label sits in; `shape.ts`, the adapter: a Tile as the shape's Frame, its rings those it offers, a ring of Children seated as the shape seats it with its clashes, the shape's placements scaled into the canvas (`canvasSize`) as `CanvasHex`es, each with a stable `key`: a Tile and what it stands for, the `ground` of a hex opened into a ring, an empty Direction with the slot it stands for (`EmptySlotTarget`), or a ring that overflows, as a list. Pure and tested |
| `view/` | `tiles.ts`, the System as the canvas reads it: `TileNode`, with its Branches, Leaves (each marked `leaf`) and Context by Direction, the Frame kinds it offers (`kindsOf`, `firstKindOf`), and `findTile` and `pathTo` for a Tile's ancestors; `view.ts`, the view state as the URL carries it: `CanvasView` (`center`, `frame`, `inner`, `expanded`), an Effect Schema whose fields each fall back to their default, resolved against a System (`showView`), and changed by `centerOn`, `toggleExpanded`, `withFrame` and `withInner`, which return the next view in its shortest form; `ringChoices`, the rings the center can show; `orDefault`, `readSearch`, `TileId`, `viewIn` and `withViewIn`, which a page's own search params reuse. Pure and tested |
| `state/` | `useCanvasState`, the canvas's state hook: the view resolved, its hexes, the rings the center shows and could show, and the actions a gesture calls, each handing the next view to `onViewChange`; `TileAction`, what a click on a Tile does. Tested |
| `Canvas.tsx` | `Canvas`: takes the System's root, the `view` and `onViewChange`, and draws the rings the center can show above the hexes; with `emptySlots`, what a click on an empty slot does and how it is named, slot by slot; with `swapTargets`, which Tiles offer to trade places with a Tile on the move, what that does and how it is named |
| `Tile.tsx`, `Frame.tsx` | `Tile`, a button with its title always and its preview when there is room, a hover card with both in full and, for a clashing Leaf, the Branch it is numbered as, and, when the caller gives it a `SwapTarget`, a second small button at the foot of its hex, apart from the Tile's, that swaps; `Frame`, the ground of a hex opened into a ring, `EmptySlot`, inert, or a button with a plus when the caller gives it an action, and `ListHex`, a ring too full to place, as a list |
| `keys.ts` | `buttonKeys`, the keys of a shape that stands for a button, shared by `Tile` and `EmptySlot`: Enter acts going down, once per press; Space acts coming up, and going down only keeps the page from scrolling |
| `look.tsx` | Colours from theme tokens (`--context` for the Context's teal, `--warning` for a clash), the stroke, and the label's type scale |
| `fixtures.ts` | The System `/dev/hex` and `/dev/system` draw, the top of this vault with Leaves beside its Branches, and the views `/dev/hex` links to |

## Rules

- **The view belongs to the URL, not to the canvas.** `Canvas` holds no view state: a gesture calls `onViewChange` with the next view, and the route navigates to it. `readCanvasView` is the route's `validateSearch`. A link from before the shape's view, its `expanded` a list of ids, keeps its center alone.
- **The view is the shape's, at depth 2** ([[4-software-engineering/1-projects/1-hexframe/STACK#A vault as a hexframe|STACK]]): the center, the Frame kind of the ring around it (`frame`: Children, or Branches or Leaves past six of them in all, as the shape offers them), the ring inside its hex (`inner`: Context, or Leaves inside Branches, never the same kind in both; none by default), and the Branches of the ring around it that open, by Direction, each into a kind it offers (`expanded`). Nothing opens further. A centered Leaf has no ring: it fills the canvas alone.
- **What is Mapping and what is not.** Tiles, Branches, Leaves, Directions and Context are Mapping's words (STACK.md); centering, the rings shown and opening a Branch are view state, and live here.
- **Gestures.** A click, Enter or Space on the center shows its Context inside it, or hides the ring shown there; on a Branch of the ring around the center, opens it into its first ring, or closes it once open; on anything else, a Leaf, a Context Tile, a member of an opened Branch, centers it, since it has nothing to open at depth 2. A centered Leaf takes no click. A double-click or Shift+Enter centers any Tile. The row above the canvas picks the ring around the center, when it offers more than one, and the ring inside it. `useCanvasState` decides each, from the hex and the view; nothing is offered a ring it doesn't have.
- **An empty slot is the caller's to use.** The canvas knows the Tile at the heart of its ring, the ring's kind and its Direction (`EmptySlotTarget`); what a click there does (add a Tile, move one there) and its accessible name come from `emptySlots`, slot by slot, as a view change comes from `onViewChange`. Without it, or where it answers nothing, empty slots stay inert, as on `/dev/hex`.
- **A Tile's click stays the view's.** A swap the caller offers on a Tile (`swapTargets`) gets a button of its own, a disc with two arrows at the foot of the hex, so opening and centering still work while a move is under way. What a swap does is the caller's, as for an empty slot.
- **A Tile keeps its key** when its Branch opens and it is drawn at the heart of its own Frame, so keyboard focus stays on it. A Context Tile, which may be a Reference to a Tile drawn elsewhere, is keyed by its slot.
- **Colour is a token**, as everywhere in `ui/`: fills and strokes are `var(--token)` or a `color-mix` of two.
