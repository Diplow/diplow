---
title: layouts
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/front/ui/layouts
owner: diplo
preview: >-
  The layouts no single side owns: shells with slots that decide where things
  go, the dialog and what a place shows instead of its content, which both
  sides share, and the table and a page's header, whose pages the one screen
  retires. A layout imports atoms, never a side.
---
# layouts

The layouts no single side owns, each a shell with slots that decides where things go and how they fold on a phone: those the Chat and the Canvas share, and those whose only users are pages the one screen retires (`DataTable`, `PageHeader`), which stay where they fit until their last user goes. A layout one side alone uses lives in that side's `layouts/` ([[4-software-engineering/1-projects/1-hexframe/1-app/src/front/ui/CLAUDE|ui]], "Rules") and comes here once the other side uses it too. A layout imports atoms, the seams and the files at `ui/`'s root, never a side (dependency-cruiser, `no-layouts-importing-up`).

| Path | Holds |
|---|---|
| `ConfirmDialog.tsx` | `ConfirmDialog`, a question asked before something is done: its trigger, a title, a description and the confirming button, destructive when it deletes |
| `DataTable.tsx` | `DataTable`, sortable, with its loading and empty states; it takes `DataColumn`s, so a feature never sees TanStack Table. Its one user, the Keys page, is one the one screen retires |
| `PageHeader.tsx` | `PageHeader`, the top of a page: its one `<h1>`, what the page is for and what can be done from it. Its users are pages the one screen retires |
| `states.tsx` | What a place shows instead of its content: `EmptyState`, nothing yet and how to add the first; `ErrorState`, a read that failed, with a retry and the request id; `Forbidden`, a read the user may not make |
| `gallery.tsx` | `LayoutsGallery`, every layout here in its states, on `/dev/ui` |
