---
title: ui
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/ui
owner: diplo
preview: >-
  The design system: a closed list of components I own, in six folders named
  for what a component is for. Only ui/ imports Radix and the other UI
  libraries; colour comes from theme tokens; light and dark from the start.
---
# ui

`ui/` is a closed list of components I own. A feature builds from it and never adds to it; a missing component is a Linear ticket that says what the feature needs to show, not which component it wants.

- Six folders, named for what a component is for: `inputs/` (with `controls/` and `forms/` inside), `surfaces/`, `overlays/`, `data/`, `feedback/`, and `hex/`, the canvas: the geometry as tested pure functions, then the tile, the frame and the canvas built on it.
- Only `ui/` imports Radix, TanStack Table, the Markdown renderer and TanStack Hotkeys. No raw `<table>` or `<dialog>` outside it. Colour comes from theme tokens, never a palette name or a hex.
- Light and dark from the start: the tokens are in `src/styles.css`, the theme's state in `theme.ts`. Beside shadcn's, `brand` (the purple) and the statuses `success`, `warning`, `info` and `destructive`, each with its `-foreground`. A new token gets a value in both themes, and a foreground if text sits on it; `tokens.test.ts` holds the theme to that.
- `/dev/ui`, in dev only, shows every component in every state. So far it shows every colour token as a swatch, read from `styles.css` by `tokens.ts`, so it cannot miss one.
- The first list: `Button`, `Input`, `Textarea`, `Field` and `useAppForm`, `Card`, `PageHeader`, `Drawer`, `ConfirmDialog`, `DropdownMenu`, `Tooltip`, `Toaster`, `Skeleton`, `EmptyState`, `ErrorState`, `Forbidden`, `DataTable`. It grows by request.

Built so far: `Button`, `ThemeToggle` and `LocaleSwitch`, in `inputs/controls/`.
