---
title: ui
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/front/ui
owner: diplo
preview: >-
  The design system: a closed list of components I own, in six folders named
  for what a component is for. Only ui/ imports Radix and the other UI
  libraries; colour comes from theme tokens; light and dark from the start.
---
# ui

`ui/` is a closed list of components I own. A feature builds from it and never adds to it; a missing component is a Linear ticket that says what the feature needs to show, not which component it wants.

- Six folders, named for what a component is for: `inputs/` (with `controls/` and `forms/` inside), `surfaces/`, `overlays/`, `data/`, `feedback/`, and `hex/`, the canvas: the geometry as tested pure functions, then the tile, the frame and the canvas built on it.
- Only `ui/` imports Radix, TanStack Table, TanStack Form, the Markdown renderer, TanStack Hotkeys and Sonner: `dependency-cruiser.config.ts` says no elsewhere. No raw `<table>` or `<dialog>` outside it, and colour comes from theme tokens, never a palette name or a hex: `eslint.config.ts` says no to both. `scripts/lint.test.ts` proves those rules still fire.
- A component takes its content as props (`title`, `entries`, `columns`), not as a family of parts to assemble, so a feature cannot rebuild it differently. `DataTable` takes `DataColumn`s, so a feature never sees TanStack Table.
- Light and dark from the start: the tokens are in `src/front/styles.css`, the theme's state in `theme.ts`. Beside shadcn's, `brand` (the purple) and three statuses, `success`, `warning` and `info`, that join shadcn's `destructive`; each has its `-foreground`. The canvas adds `context`, the Context's teal, which only strokes and tints hexes and so has no foreground. A new colour gets a value in both themes and a line in `@theme inline`, which `tokens.test.ts` checks, and a foreground if text sits on it.
- `/dev/ui`, in dev and on previews, shows every colour token as a swatch, read from `styles.css` by `tokens.ts` so it cannot miss one, then every component in every state, except `ThemeToggle` and `LocaleSwitch`, which sit in every page's header, and `hex/`, which has `/dev/hex`. Each folder shows its own components in its `gallery.tsx`, framed by `GallerySection` and `GalleryState` from `gallery.tsx` here; a new component gets its section there.
- The first list: `Button`, `Input`, `Textarea`, `Field` and `useAppForm`, `Card`, `PageHeader`, `Drawer`, `ConfirmDialog`, `DropdownMenu`, `Tooltip`, `Toaster`, `Skeleton`, `EmptyState`, `ErrorState`, `Forbidden`, `DataTable`, `CodeBlock`, and the canvas, `Canvas`. It grows by request.

| Folder | Holds |
|---|---|
| `inputs/controls/` | `Button`, `Input`, `Textarea`, `ThemeToggle`, `LocaleSwitch` |
| `inputs/forms/` | `Field` (a label, a control, its description and errors) and `useAppForm` (TanStack Form with the fields `TextField`, which takes a `type` (text, email, password) and an `autoComplete`, `TextareaField` and the `SubmitButton`) |
| `surfaces/` | `Card`, `PageHeader` |
| `overlays/` | `Drawer` (controlled: its open state belongs in the URL), `ConfirmDialog`, `DropdownMenu`, `Tooltip` |
| `data/` | `DataTable`, sortable, with its loading and empty states; `Markdown.tsx`, the seam STACK.md names for a Tile's content, holding for now `CodeBlock`, text shown as written, which a Leaf that isn't Markdown shows its Body in: the Markdown renderer, when a Body is rendered, comes in there |
| `feedback/` | `Toaster` and `toast`, `Skeleton`, in `states.tsx` `EmptyState`, `ErrorState` and `Forbidden`, and `useLeaveGuard`, which asks before the page is closed or reloaded while something is on its way, the browser wording the prompt |
| `hex/` | `Canvas`, `Tile` and `Frame` on the tested geometry and view state: [[4-software-engineering/1-projects/1-hexframe/1-app/src/front/ui/hex/CLAUDE\|hex]] |
