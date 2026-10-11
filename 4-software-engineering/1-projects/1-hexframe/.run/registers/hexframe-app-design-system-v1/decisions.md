---
title: decisions, hexframe app Design system v1
parent: 4-software-engineering/1-projects/1-hexframe/.run/registers/hexframe-app-design-system-v1
owner: diplo
preview: >-
  The choices the autonomous run made while making the design system
  hexframe's, where a ticket left room: what each use of the retired brand
  colour became, what "dark by default" leaves of the system's preference,
  how the radius scale squares every corner, the lines of STACK.md and
  claude-mod left for the phase close, where each piece of ui/ went when it
  regrouped by tier and side, and how /design-system shows the error channels,
  reads "made of" from the code and keeps its frame outside the tiers.
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

### DEC-5 A side is the side of the screen a piece is used on, features included

HEX-93. The rule (an atom or a layout lives in the side that uses it, and is shared once the other side uses it too) needs to know who uses a piece. Inside `ui/` the Chat has no component yet, so counting only `ui/`'s own imports would have left `chat/` empty and every atom shared. I counted the features that draw each side instead: `features/conversation/` draws the Chat; `features/system/`, `features/help/` and `features/breadcrumb/` draw the Canvas. The root's header, Access, Keys and the `/dev` pages are on no side: they are what the one screen retires. So:

- **Shared atoms** (`ui/atoms/`): `Button`, `Input`, `Textarea`, `Field`, `useAppForm` (both sides); `Toaster` (every channel of the client) and `Skeleton` (the chat and home's loading); `DropdownMenu`, which nothing uses yet, and `ThemeToggle` and `LocaleSwitch`, used by the header alone, stay where they fit.
- **Shared layouts** (`ui/layouts/`): `ConfirmDialog` (a Proposal in the chat, a Tile's delete on the canvas) and `EmptyState`, `ErrorState`, `Forbidden` (the chat, and `ReadBoundary`, around both sides on home); `PageHeader` and `DataTable`, whose users the one screen retires, stay where they fit, as the ticket says.
- **The Chat's own** (`ui/chat/atoms/`): `Suggestions`, the composer's alone.
- **The Canvas's own** (`ui/canvas/atoms/`, `ui/canvas/layouts/`): `Tooltip` (a Tile's hover card) and `useLeaveGuard` (the System's writes in flight); `Card` and `Drawer`, which the System's and Help's pages alone use, Keys and Access aside. HEX-102 and HEX-103 move the tile forms, Keys and Help into the chat, so `Card` and `Drawer` will likely move again, to the chat or to the shared layouts, with their users.
- **The seams** (`ui/seams/`): `Markdown.tsx`, below the tiers, since what it wraps is a library, not a piece of the screen. STACK.md's hotkeys seam joins it with the first shortcut.

dependency-cruiser holds the result, the seams below the shared atoms (`no-side-importing-the-other`, `no-layouts-importing-up`, `no-atoms-importing-up`, `no-seams-importing-up`), as it already holds features apart, and `scripts/lint.test.ts` proves each rule fires. `/dev/ui` shows the same pieces in the same states, now tier by tier (shared atoms, shared layouts, the chat's, the canvas's, the seams) where it went by role before.

### DEC-6 Two frozen pages still name `ui/hex/` and "six folders"

HEX-93. `2-claude-mod/hooks/shape/CLAUDE.md` links the canvas as `1-app/src/front/ui/hex/CLAUDE` and names `1-app/src/front/ui/hex/`; the folder is now `ui/canvas/`, so its wikilink is broken. STACK.md's "Design system" section says `ui/` holds its components "in six folders"; it now holds five, by tier and side. Both files are frozen for this run, so both lines stay. The phase close lists them for Ulysse: `ui/hex/` becomes `ui/canvas/` in claude-mod's page, and STACK.md's sentence can drop the count or say "by tier and side".

### DEC-7 `/dev/errors`' channels became states, and the calls that provoked them went

HEX-94. `/dev/errors` provoked each channel through server functions that answered `NotFound` outside dev and previews, so on a page served in production they could show nothing. `/design-system` shows the channels instead as `ReadBoundary` (`ReadFailure`), a toast and a form show them, on domains' refusals and an `Unexpected`, with no call made (`client/gallery.tsx`). With the page gone, `api/dev/provoke.ts` and `programs.ts` had no caller, so they went, and with them the message table's entries scoped to `submitDevTitle`, whose tests now prove a scope narrows a message on Mapping's own scoped entries. `api/dev/failures.ts` stays, `DevNotFound` aside, which nothing sent any more: its failures, one per kind the tests need, are what the tests of the error model and of the client's channels fail with where no domain's refusal is the point, and they stay members of `Failure` so a test can send one over the wire and decode it back. `submitMutation`, a form that stays open until its answer, keeps no production caller until such a form comes.

### DEC-8 "Made of" is read from a piece's files, and a feature or the client can be a piece

HEX-94. The ticket asks for "made of" and "used in" between pieces. Written by hand, they would drift from the code, so `gallery/pieces.ts` names each piece's files and its "made of", and `pieces.test.ts` reads the same list from those files' imports, through the files that are no piece of their own; "used in" is read back from it. The reading is a file's, not a component's: `EmptyState`, `ErrorState` and `Forbidden` share `layouts/states.tsx`, so the test asks that each names only what the file imports, and that together they name it all; only `ErrorState` names `Button`. The page shows two features' pieces where `/dev/system` showed them, the `Conversation` in the Chat and the `Breadcrumb` in the Canvas, and the client's channels among the layouts the sides share, since what they show is `ErrorState`, `Forbidden` and the toast. `ThemeToggle` and `LocaleSwitch`, which only the header showed, got their sections too, and the seams come after the atoms, where the ticket's order did not place them.

### DEC-9 The page's frame is `ui/gallery/`, outside the tiers

HEX-94. The catalogue, its test and the tokens' notes would have put seven files in `ui/`, past the rule of 6. They went into a folder of their own, `ui/gallery/`, with the frame and the stylesheet's reading: every folder's `gallery.tsx` imports it, and it imports none of them, so dependency-cruiser's tiers do not name it. `tokens.ts` became `gallery/stylesheet.ts`, since `Tokens.tsx` beside it would clash with it on a filesystem that ignores case, and it now reads every token, the fonts, the sizes, the radius scale, the easings and the durations beside the colours, so each gets its note. TOKENS.md's tables became those notes; its "Phone and touch" and "Light" became prose on the page. Until HEX-112 retires `3-design-system/`, which this run may not edit, TOKENS.md keeps its copy: where the two differ, `gallery/Tokens.tsx` wins, as `ui/gallery/CLAUDE.md` says.
