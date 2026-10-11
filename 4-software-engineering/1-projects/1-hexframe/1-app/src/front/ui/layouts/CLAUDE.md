---
title: layouts
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/front/ui/layouts
owner: diplo
preview: >-
  The layouts no single side owns: shells with slots that decide where things
  go, the one screen both sides sit in, cut along its curve wide and one side
  in front on a phone, the dialog and what a place shows instead of its
  content, which both sides share, and the table and a page's header, whose
  pages the one screen retires. A layout imports atoms, never a side.
---
# layouts

The layouts no single side owns, each a shell with slots that decides where things go and how they fold on a phone: those the Chat and the Canvas share, and those whose only users are pages the one screen retires (`DataTable`, `PageHeader`), which stay where they fit until their last user goes. A layout one side alone uses lives in that side's `layouts/` ([[4-software-engineering/1-projects/1-hexframe/1-app/src/front/ui/CLAUDE|ui]], "Rules") and comes here once the other side uses it too. A layout imports atoms, the seams, the files at `ui/`'s root and, in its `gallery.tsx`, the page's frame in `gallery/`, never a side (dependency-cruiser, `no-layouts-importing-up`).

| Path | Holds |
|---|---|
| `screen/` | `Screen.tsx`, `Screen`, hexframe's one screen, a shell with four slots, `canvas`, `corner`, `messages` and `composer`: wide, the chat a column on the left cut along one curve, the canvas filling the screen behind it right of the curve, the corner top right; below `sm` of the screen's own width (a container query, so a specimen folds as a phone does), one side in front, which the caller holds (`front`, `onFrontChange`), the chat with the canvas showing through a strip at its top, or the canvas with the composer kept at its foot, a seam between them that a tap, a drag or the keyboard turns, the side behind `inert`. `curve.ts`, the curve, pure and tested: its offset from the chat's edge and how far it reaches, the cut as a `clip-path` in percentages, its SVG path and the track beside the messages, and the star's place and the scroll it gives. `Scrollbar.tsx`, `Scrollbar`, the hairline drawn along it and the star riding the stretch beside the messages, lighting what shows, held and dragged, a click on the track scrolling there; hidden from the accessibility tree, since the messages stay a focusable scroller. The width it turns wide at is written once, `--container-wide` (`@wide:`, `@max-wide:`), and the seam's display tells the code. Its specimens sit in `/design-system`'s route, which may lay out both sides |
| `ConfirmDialog.tsx` | `ConfirmDialog`, a question asked before something is done: its trigger, a title, a description and the confirming button, destructive when it deletes |
| `DataTable.tsx` | `DataTable`, sortable, with its loading and empty states; it takes `DataColumn`s, so a feature never sees TanStack Table. Its one user, the Keys page, is one the one screen retires |
| `PageHeader.tsx` | `PageHeader`, the top of a page: its one `<h1>`, what the page is for and what can be done from it. Its users are pages the one screen retires |
| `states.tsx` | What a place shows instead of its content: `EmptyState`, nothing yet and how to add the first; `ErrorState`, a read that failed, with a retry and the request id; `Forbidden`, a read the user may not make |
| `gallery.tsx` | `LayoutsGallery`, every layout here in its states, on `/design-system` |
