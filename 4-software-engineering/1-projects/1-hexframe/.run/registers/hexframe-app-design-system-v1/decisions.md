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
  regrouped by tier and side, how /design-system shows the error channels,
  reads "made of" from the code and keeps its frame outside the tiers, what
  the composer's proposal kept and changed of the reference, where the frames
  HEX-96 proposed went and how a finger opens them, how HEX-95 drew the
  screen, folding on its own width, a seam on a phone, and the corner's
  contrast, how the chat's pieces take their text, every ink raised to
  4.5:1, a decided Proposal's receipt unfolding its changes, and how HEX-97
  built the screen on home: who holds the side in front, the breadcrumb drawn
  as the rail, what the header keeps, and the gaps left to M3.
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

### DEC-10 The composer is a chat component with its own list, the field a textarea with its marks drawn under it

HEX-99, a proposal. `components.html#commands` drew the composer on a contenteditable, the list rising from its top line, a command a chip in amber mono. The proposal keeps the look and changes four things:

- **The field stays a textarea.** The feature's `@` already works on its string, tested (`features/conversation/composer/mention.ts`); a contenteditable would bring its input methods, paste and undo back to solve. What the field marks, the command it opens with in amber and each Tile it points at underlined, is drawn under it in the same type, so the command keeps the field's serif rather than the reference's mono chip, whose other width would put the caret out of step.
- **The list is the composer's own**, `ui/chat/composer/List.tsx`, not `Suggestions`: it rises from the composer's top line as wide as the conversation, with groups, icons, a footer of keys and a line when nothing answers, none of which `Suggestions`' popover over its field has. `Suggestions` stays for the feature's composer until HEX-101 moves it onto `Composer`, its last user.
- **The step above the composer is HEX-98's**, the conversation's "thinking": the composer shows a Turn running by its field waiting and send becoming Stop, and nothing else.
- **Quiet text is `muted-foreground`, not `faint`.** `faint` on `card` is 2.96:1 in dark and 4.09:1 in light, under the 4.5:1 text needs; the reference set the mode, the key hints, the descriptions and the paths in it. `faint` stays on the inactive rows' icons, which say nothing their names don't.

- **`ui/` knows no domain.** No piece of `ui/` imports one, so the Composer takes the Modes as choices its caller builds from Assistant's `Mode`, and the gallery's demo follows the feature's `@` rules (`mention.ts`, 40 characters, ranked, 8 at most) rather than importing them. The commands sit in `ui/chat/composer/commands.ts` while they are a proposal, since the page can only show what `ui/` holds; HEX-101, which runs them through the client's hooks, moves them beside the feature's `@`, and `List` and `cutAround` stay.

The commands are the reference's, the theme aside, which goes to the breadcrumb's head (Q8), with the language and signing out added; which ones stay is an open question on the pull request, as is amber text in light, 3.75:1 on `card`, the tokens' own.

### DEC-11 The frames go where their users will be, and `Menu` replaces `DropdownMenu` in place

HEX-96. The ticket places the widget's frame in `ui/chat/` and says each frame goes to the side that uses it. Nothing uses the frames yet, so each went where the builds will use it, as DEC-5 placed `DropdownMenu`:

- **`Widget`**, `ui/chat/layouts/`: the conversation alone draws widgets.
- **`Dialog`**, `ui/layouts/`: a Tile's delete opens it from the canvas, a Proposal's discard and a Key's revoke from the chat, as `ConfirmDialog`, which it supersedes, is shared.
- **`Menu`**, `ui/atoms/`: a widget's settings (the chat) and a tile's actions (the canvas) are both menus. It took `DropdownMenu`'s file: nothing used `DropdownMenu`, so the ticket's "replacing the piece it supersedes once its last user has moved" held already. It stays an atom, as `DropdownMenu` was, although the ticket calls the frames layouts: a menu is a control that knows nothing of hexframe, its header a slot, and `ui/layouts/` has room for one more file only, which `Dialog` took.
- **`HoverCard`**, `ui/canvas/layouts/`: only a tile has one.

`ConfirmDialog`, `Tooltip` and `Drawer` stay until their users move, in the builds of M3 and M4.

### DEC-12 `Act`, the action the frames share, is an atom

HEX-96. The widget's actions, the receipt's undo and the dialog's two are the prototype's `.act`, a word led by a small hex, and `.btn`, the one solid act cut as a long hex. Drawn inside each frame they would have been three copies, so they are one atom, `ui/atoms/controls/act.tsx`, in the voice of the surface it sits on (`--voice`). It is not `Button`'s replacement: a form's buttons are HEX-100's to redraw.

### DEC-13 Under a finger, the long press opens the menu, and the menu's header says what the hover card would

HEX-96, the project's "To grill". A finger can't hover, and a long press is the menu's. Rather than a second gesture (a tap that shows the card before acting, a press that shows it before the menu), the card never opens under a coarse pointer: the menu's header, a tile's title and place, shows its preview in full there too (`MenuHeader.description`). One gesture, no collision; a tap stays the tile's, which HEX-105 decides. The widget does the same with its tools: under a finger the settings' control alone shows, 44px, and folding and dismissing wait in its menu.

### DEC-14 On a phone, the dialog is a sheet

HEX-96, the project's "To grill". Below `sm` the chat fills the screen, so there is no column for the dialog to open over: it rises from the bottom, the screen's width, the act within the thumb's reach. Wide, it opens over the conversation's column from its left edge, 28rem, a little below the top.

### DEC-15 A risen surface's shadow and the widget's entrance became tokens

HEX-96. The prototype kept `--lift`, a menu's, a card's and the dialog's shadow, out of the tokens ("not tokens yet"); the frames all use it, so it is `--shadow-lift`, from `--lift`, which each theme sets. The widget's entrance, its line drawing itself, the surface unfolding and its parts rising, and the light that runs over lines still to come, are `--animate-draw`, `--animate-unfold`, `--animate-rise` and `--animate-sweep`. Each has its note on `/design-system`. The three frames that rise share one utility, `risen` (`styles.css`): the popover's light, `--shadow-lift` and a fine line on top, which the dialog draws in its voice through `--rim`.

### DEC-16 The screen folds on its own width, and the side in front is its caller's

HEX-95. "Below `sm`, a phone" is read on the screen's own width, a container query, not the viewport's: on home the screen fills the viewport and the two agree, and on `/design-system` a phone's specimen folds as a phone does beside a wide one. The width is written once, `--container-wide: 40rem` in `@theme`, so the classes say `@wide:` and `@max-wide:`, and the Tokens page gives it a note. What CSS can't do, making the side behind `inert`, waits for a `ResizeObserver` once the page is live, which asks the stylesheet rather than measuring again: the seam shows on a phone alone, so its display is the answer. The first paint is right, and the keyboard is right from hydration. Which side is in front is a prop, `front` and `onFrontChange`, as the canvas's view is: HEX-97 gives it its owner and its state hook, and the crossing that brings the canvas forward when the chat points at it.

### DEC-17 On a phone, a seam: the canvas peeks above the chat, the composer stays at the canvas's foot

HEX-95, on the project's "To grill: the gesture that brings the canvas forward". The prototype's phone kept the composer alone over the canvas; that became the canvas in front. With the chat in front, the canvas shows through a strip at the screen's top, blurred, and the strip is the seam: a tap, a drag down, or Enter brings the canvas forward. With the canvas in front, a seam above the composer gives the chat back, by a tap, a drag up, or Enter, and the focus crosses to the seam on the other side. A drag decides past 24px, it doesn't follow the finger yet. The canvas's corner, the theme with it, belongs to the canvas, so on a phone it shows with the canvas in front only.

### DEC-18 The rail's labels are muted, not faint, and the theme is the disc everywhere

HEX-95. The prototype's path labels are `faint`, which reads at 3.1:1 on the ground in the dark and 3.6:1 in the light, short of 4.5:1 for 13px text; they are `muted-foreground` (7.9:1, 6.5:1), the step you are on the foreground. The disc and the seams stay `faint`, a mark needing 3:1. `ThemeToggle` became the design system's disc rather than a second atom beside the sun and moon, so the header shows it too until HEX-97 moves it to the rail's head.

### DEC-19 What the screen leaves to the canvas: tiles running under the conversation, the composer on a tile's edge

HEX-95. The `Screen` gives the canvas the screen right of the curve, behind a veil that fades toward it; today's `Canvas` fits its rings in that box, so its tiles reach the curve rather than running far under the conversation, and the composer's corner does not yet sit on the edge of the tile south-west of the center. Both need the canvas's camera, which knows its tiles' size and place (HEX-104, HEX-106). The ring chooser above the canvas stays where `Canvas` draws it, at the box's top left, until commands take what a menu would hold.

### DEC-20 The screen's specimens stay in the route, and signed out they read Help itself

HEX-95, cubic's reviews. Moved out of the route body to a folder the router skips, `routes/-design-system/`, the specimens were encrypted on GitHub: `.gitattributes` hands every name starting with `-` to transcrypt, and CI checks out without the key. They went back into `design-system.tsx`. The signed-out specimens first drew a hand-made Help, its titles copied into messages, a second copy of a System Mapping owns; they read Help itself now, `useHelp` in the page's language inside a `ReadBoundary`, as `/help` does, so they show what a visitor signed out sees and cannot drift from `help/`.

### DEC-21 The chat's text is `Words`, and the Proposal is a `Widget` that leaves a `Receipt`

HEX-98. No piece of `ui/` imports a domain, the canvas's included, and a component takes its content as props, so the chat's pieces take no Assistant's Entry. Where they name a state the domain names too, a Proposal's `Fate`, they keep their own union: HEX-101 hands them the domain's, which stops compiling should the domain grow a member `ui/` cannot draw. Each takes its text as `Words` (`ui/chat/text/words.tsx`): plain words, a tile named (a `Mention`'s props) and who acted, by name, in the order the sentence's language puts them. A feature reads its message with a mark in each tile's place and weaves the tiles in (`weave`, beside `Words`, tested), so a sentence is never split into fragments a translator can't reorder. The pieces of `components.html#text` became `Message` (both voices, one piece, since they share the column and the copy), `Thinking`, `Mention`, `Events` (a navigation, a change, the live step and a Turn's end as lines, by who acted, a run of reads folded), `DaySplit`, `Proposal` and `Receipt` (what an accepted Proposal and a Turn that applied its changes both leave, with the Undo), and the chat's atom `Fold`, the one line that opens what it hides, and `HexMark`, no piece of its own. HEX-101 wires these into `features/conversation/`, which still draws v0's look meanwhile.

HEX-96's frames landed while this was in review, and the two met. HEX-98 had its own `Act` in `ui/chat/atoms/`; it gave way to HEX-96's, the atom both sides share (DEC-12), each of its uses kept. The Proposal had drawn its own zone until the widget's frame landed: it is a `Widget` in the agent's voice now, its changes the body, Accept its first action with ⌘↵, Discard apart and asked through `Dialog`, which supersedes `ConfirmDialog` (DEC-11). Decided, it leaves HEX-98's `Receipt` rather than the widget's `done` line: the receipt takes the focus the widget had, says it was undone, keeps the changes folded under it and writes the time in the reader's zone, none of which the widget's line does. So two lines say what a decision left for now, the widget's `done` and `Receipt`; which one stays is a question on HEX-98's pull request. HEX-95's screen landed after: its specimens' conversation, drawn by hand until the chat's text was proposed, is the `Message`s now.

### DEC-22 Every ink reads at 4.5:1, `faint` included, and a decided Proposal's receipt unfolds its changes

HEX-98, Ulysse's answers to two of its pull request's questions. `faint` measured 3.1:1 on the ground in dark and 3.6:1 in light, and in light `destructive` 4.1:1, `human` 3.3:1, `warning` 3.4:1 and `success` 4.2:1, under the 4.5:1 small text needs. Each rose, its hue and chroma kept, to just past 4.5:1 on the ground and on a card: `faint` to L 0.595 in dark and 0.527 in light, in light `human` to 0.532 (`ring`, `sidebar-ring` and `chart-1` with it, the same amber), `destructive` to 0.533, `warning` to 0.545, `success` to 0.507 (`chart-5` follows `faint`). Dark's other inks already passed. `gallery/tokens.test.ts` now holds every ink to it, in both themes, so a token cannot fall under again unnoticed. The values part from `3-design-system/`'s, frozen until HEX-112 retires it; the app's are the ones that count. So `Fold`, which had moved to `muted-foreground` for its contrast alone, is `faint` again, as `components.html` draws it; the composer's quiet text (DEC-10) and the rail's labels (DEC-18), moved for the same reason, could go back too, each left to its next ticket.

A decided Proposal's `Receipt` keeps its changes, folded under its line (`Change` and `Changes` moved into `Receipt.tsx`, which the Proposal's zone draws its list with too): what an accepted one changed, what a discarded one would have. Its `Fold` comes last on the line, after the time, so the keys and a screen reader reach the list as the eye does, below it; a Turn's receipt takes its changes alike.

### DEC-23 The side in front is a state hook beside the screen, not the URL

HEX-97. STACK's state table first asks whether a link should carry it: no, since the side in front matters on a phone alone, and a link sent from a phone opens on any width. So it is `useScreenState` (`ui/layouts/screen/state/`), tested beside it, which home and the screen's specimens on `/design-system` call, so the screen stays its caller's (DEC-16). The chat when the screen opens; `turn`, the seam; `cross`, the crossing DEC-16 left to this ticket: a Message's link centers its Tile and brings the canvas forward. On a wide screen the side in front changes nothing drawn, and waits there for the screen to fold.

### DEC-24 The breadcrumb is the rail, and the theme lives at its head alone

HEX-97, on cubic's P3 from HEX-95's review. `Breadcrumb` became the thin wrapper that works out the steps and draws `Rail`; the horizontal trail and its hex glyphs went, and so did the path the screen's specimens repeated. Before the System is read, or once reading it failed, it draws the rail without a step, so the theme stays reachable. Help draws it in its canvas's corner too. `ThemeToggle` left the header, and since the corner's rail is now its only user, it moved from `atoms/` to `canvas/atoms/` (ui's rule: an atom one side alone uses lives in that side). The pages without a breadcrumb, Keys, sign-in, sign-up and `/dev/session`, have no theme switch until HEX-103 retires them; `/design-system` switches it from its specimens.

### DEC-25 The header keeps the language until the composer takes it

HEX-97. The ticket leaves the header the links HEX-103 retires: the System, Keys, Help. The language switch stays beside them, since no other place offers it until HEX-101 builds the composer's `/language`. The header's height is written once, `--header: 4.25rem` on the document's body in `__root.tsx`, which the header takes and home's screen and Help leave themselves (cubic's first local review), so the screen fills the viewport below it with nothing to scroll; it goes with the header in HEX-103.

### DEC-26 What home draws that HEX-95 didn't propose, until M3 redraws it

HEX-97. The chat's slots hold today's pieces, taken apart rather than redrawn: the timeline, its day labels on a strip of the card's ground, and today's composer with its hint lines, tall on a phone, both in `features/conversation/` until HEX-101 builds the conversation's text and the composer HEX-98 and HEX-99 proposed. The composer's zone sits on the card's ground, as the proposed composer does, so the canvas never shows through it. The centered Tile's card stays at the canvas's foot, at most 30% of its height, until HEX-102 moves the forms into the tile widget. A move's banner, which `System` drew across the canvas's top, went to its foot, above the card, since the corner now sits over the canvas's top right and covered its Cancel (cubic's third local review). Two things the screen needed to hold real content: on a phone the canvas ends above the composer, whose height the screen measures, and above the seam, whichever side is in front (cubic's second local review), so the card is never under either; and the conversation stays at its foot as it grows, home's lines arriving after the first paint, and as its scroller shrinks, the agent's step appearing above the composer, while the reader hasn't left it. After cubic's first local review the reader leaves it by scrolling up, or by acting in a conversation too short to scroll, so an earlier day they asked for stays in view, and writing at the foot brings it back; the rule is `keptAtFoot`, pure and tested in `screen/state/latest.ts`, the screen's effect wiring its listeners alone. What the screen's slots share comes from the screen too: `--screen-clear`, how far the chat's foot keeps its content from the curve, worked out from the screen's own lengths, and `cornerPlace`, where the corner sits, which Help and the specimens take. Checked in a browser, light and dark, English and French, wide and in a 390px frame; the window would not narrow and claude-in-chrome emulates no touch, so the finger's 44px targets were not looked at here.
