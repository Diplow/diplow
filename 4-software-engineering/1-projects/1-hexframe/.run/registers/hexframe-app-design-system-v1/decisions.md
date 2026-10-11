---
title: decisions, hexframe app Design system v1
parent: 4-software-engineering/1-projects/1-hexframe/.run/registers/hexframe-app-design-system-v1
owner: diplo
preview: >-
  The choices the autonomous run made while making the design system
  hexframe's, where a ticket left room: what each use of the retired brand
  colour became, what "dark by default" leaves of the system's preference,
  how the radius scale squares every corner, and the line of STACK.md left
  for the phase close.
---
# Decisions

### DEC-1 Each use of `brand` moves to the ink, but the move in progress, which is the human's

HEX-92, [#105](https://github.com/Diplow/diplow/pull/105). `brand`, the purple, had five uses; each went to what it meant, by DIRECTION's principles 3 and 4 (amber says "you", not "here"; a primary button is quiet):

- **A tile's and a frame's hover stroke** (`ui/hex/Tile.tsx`, `ui/hex/Frame.tsx`): `primary`, the ink. A hover says "here", and the center's line is neutral for the same reason.
- **The swap button** (`ui/hex/Tile.tsx`, `SwapButton`): `primary` with `primary-foreground`, a quiet button. Under the pointer its rim turns `primary` too, so the disc grows: `primary-foreground` is the ground itself in dark, so a rim in it showed nothing.
- **The import's drop zone while a drag is over it** (`features/system/import/Import.tsx`): `primary`, "here" again.
- **The banner of a move in progress** (`features/system/System.tsx`): `human`, since it marks what you are doing, as the rule beside your words does.

The proposals (HEX-104, HEX-105) redraw the tile, its hover and its swap; these are the stand-ins until they land.

### DEC-2 Dark by default means the system's preference no longer counts

HEX-92, [#105](https://github.com/Diplow/diplow/pull/105). The design system's "Installing it" says the project puts `dark` on `<html>` "unless the user chose light", and DIRECTION makes dark the default. `themeScript` now paints dark unless the stored choice, made with the toggle, is light; an OS set to light no longer picks light on a first visit, where it did before. `useThemeState`'s server render starts from dark to match.

### DEC-3 The whole radius scale is a multiple of `--radius`

HEX-92, [#105](https://github.com/Diplow/diplow/pull/105). The registry sets `--radius: 0rem` and leaves the scale to shadcn's `init`. The app's scale came from an older `init`, `calc(var(--radius) - 4px)` to `calc(var(--radius) + 4px)`, which keeps `rounded-xl` at 4px when the radius is 0. `styles.css` now writes every step, `xs` to `4xl`, as a multiple of `--radius`, the form shadcn's current `init` uses, so no token rounds a corner. A literal radius stays as written (the tooltip's arrow, `rounded-[2px]`), and `rounded-full` stays round on purpose.

### DEC-4 STACK.md still says "light and dark from the start"

HEX-92, [#105](https://github.com/Diplow/diplow/pull/105). Its "Design system" section says `ui/` has light and dark "from the start", where the app is now dark by default with light as its equal (DEC-2). STACK.md is frozen for this run, so the line stays as it is. The phase close lists it for Ulysse, with the wording of `ui/CLAUDE.md`'s preview: "dark by default, light as its equal".
