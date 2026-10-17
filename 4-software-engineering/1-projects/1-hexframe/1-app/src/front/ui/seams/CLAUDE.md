---
title: seams
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/front/ui/seams
owner: diplo
preview: >-
  The seams STACK.md names in ui/, each the one file that changes when a
  library behind it comes or goes. For now the Markdown one, for a Tile's
  content, holding CodeBlock until the Markdown renderer comes in.
---
# seams

A seam is one file a library sits behind, so swapping the library changes that file and nothing else (STACK.md: beta and alpha only behind a seam). The ones STACK.md names in `ui/` live here, below the tiers, since what they wrap is a library, not a piece of the screen: any piece may draw with a seam, and a seam imports no tier, neither an atom, a layout nor a side, only the files at `ui/`'s root and, in its `gallery.tsx`, the page's frame in `gallery/` (dependency-cruiser, `no-seams-importing-up`).

| Path | Holds |
|---|---|
| `Markdown.tsx` | The seam for a Tile's content, holding for now `CodeBlock`, text shown as written, which a Leaf that isn't Markdown shows its Body in: the Markdown renderer, when a Body is rendered, comes in here |
| `gallery.tsx` | `SeamsGallery`, `CodeBlock` on `/design-system` |

The hotkeys seam STACK.md names for TanStack Hotkeys comes here too, with the first shortcut.
