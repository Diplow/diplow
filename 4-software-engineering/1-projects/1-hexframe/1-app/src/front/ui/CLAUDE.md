---
title: ui
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/front/ui
owner: diplo
preview: >-
  The design system: why hexframe looks the way it does (six principles, one
  screen with two sides), the words for its screen (the Chat, the Canvas, the
  crossings; components, atoms and layouts), then its closed list, by tier and
  side, in atoms/, layouts/, chat/, canvas/ and seams/, shown top-down at
  /design-system from gallery/. Only ui/ imports Radix and the other UI
  libraries; colour comes from theme tokens; dark by default, light as its
  equal.
---
# ui

hexframe's design system: the look, the words for its screen, and the closed list of components I own. The look was found in a prototype, then written down as tokens and fonts in `4-software-engineering/1-projects/3-design-system/`, which stays the reference its pages are ported from until HEX-112 retires it. What follows moved in from there.

## The direction

What hexframe holds is a perspective, one a person crafts over a lifetime and that agents keep working with. The look is futuristic because hexframe is a bet on a future worth wanting: human experience at the center, people directing agents that help them find where they want to explore. Futuristic here means space, imbalance, fine lines and light, not chrome. Obsidian is the closest relative.

1. **Empty space and imbalance.** Nothing is centered for its own sake. On hexframe's main screen the canvas takes about 60% of the width, off to the right, and the tiles around the center run on behind the conversation instead of stopping at a frame. Space is the luxury: a screen is never filled to show it is busy.
2. **Light before lines.** A surface is drawn by its light, not by an outline: a tile is a fill, lighter than the ground, with the gap between tiles showing the ground. An opened tile loses its outline and leaves its own tile and its six around it. Only the center keeps a line. Where a separator is needed it is a hairline or a curve, never a box: a zone of the conversation is a solid fill with one fine line on top, a field is one underline.
3. **One warm light, at the root.** Amber belongs to the human. The root of a system, your own tile, holds its one warm light: lit amber, with a glow behind it that stays there as you move. Below the root the glow only hints where the root is, waiting at the edge of the screen when the root is off it. The center you look at gets a neutral line, never the warm light: amber says "you", not "here". The brand mark, the rule beside your words and the send button are amber for the same reason.
4. **A warm human, a cool agent.** Your words are set in Newsreader, a light serif; the agent's in Geist Mono, violet-marked. What the agent drafts glows violet until you take it. The interface itself speaks in Geist, quietly, so the two voices carry the page. Warning, the colour shadcn would make amber, is an ember orange, so amber keeps one meaning.
5. **Curves as separators.** The conversation is cut along one curve, which also serves as its scrollbar: a star rides it, lighting the stretch you see. The layout meets the geometry: the composer's corner sits on the edge of the tile south-west of the center.
6. **Motion tells the hierarchy.** Moving to a neighbour pans; to a child or a parent zooms, the scale changing evenly; an opened tile's children bloom out of its heart, one after another, and fold back into it. A change of theme is a change of light, not a flip. With reduced motion, everything lands at once.

Dark is the default and light is not an afterthought: the same rule holds in both. A surface rises toward light, white on paper by day, ink at night, so a tile is always lighter than the ground. The warm light behind the root is softer on paper, where a glow shows as a tint.

### One screen, two sides

hexframe is one screen, with no menu and no page to go to. Everything happens in the chat, where you and the agent act; the canvas carries what you act on, and the way through it. Each side answers the other, and that is most of the art: a tile named in the chat lights up on the canvas, the agent at work marks the tile it is in, and the tile you center on the canvas is where the agent works next. Signed out, it is the same screen: the canvas shows hexframe's help, and the chat asks who you are. On a phone the chat stays in front and the canvas behind it, as the tiles run on behind the conversation on a wide screen; the canvas comes forward when the chat points at it, then gives it back.

## hexframe's screen, in words

hexframe is one screen with two **sides**, and nothing to navigate outside them. The **Chat** shows the Conversation: the user and the agent act there, and whatever a menu would do happens there. The **Canvas** shows the System: it carries what they act on, and the way through it. The **crossings** are where one side answers the other, both ways: a tile named in the chat lights up on the canvas, a tile centered on the canvas is where the agent works next.

A side is made of **components**, a chat component or a canvas component, built from **atoms**, a control that knows nothing of hexframe (a button, a field), inside **layouts**, a shell with slots that decides where things go and how they fold on a phone (the widget's frame, the dialog's). An atom or a layout lives in the side that uses it, and is shared once the other side uses it too. The width picks the layout, a phone showing one side at a time; a finger picks the behaviour, at any width. The tokens on `/design-system` say where each begins (`gallery/Tokens.tsx`).

## The closed list

`ui/` is a closed list of components I own. A feature builds from it and never adds to it; a missing component is a Linear ticket that says what the feature needs to show, not which component it wants.

| Folder | Holds |
|---|---|
| `atoms/` | The atoms both sides share: `Button`, `Input`, `Textarea`, `ThemeToggle`, `LocaleSwitch`, `Field` and `useAppForm`, `DropdownMenu`, `Toaster`, `Skeleton`: [[4-software-engineering/1-projects/1-hexframe/1-app/src/front/ui/atoms/CLAUDE\|atoms]] |
| `layouts/` | The layouts both sides share: `ConfirmDialog`, `DataTable`, `PageHeader`, `EmptyState`, `ErrorState`, `Forbidden`: [[4-software-engineering/1-projects/1-hexframe/1-app/src/front/ui/layouts/CLAUDE\|layouts]] |
| `chat/` | The Chat's own pieces: the conversation's text, `Message`, `Thinking`, `Mention`, `Events`, `DaySplit`, `Proposal` and `Receipt`, and its atoms, `Suggestions`, `Act` and `Fold`: [[4-software-engineering/1-projects/1-hexframe/1-app/src/front/ui/chat/CLAUDE\|chat]] |
| `canvas/` | The Canvas: `Canvas`, `Tile` and `Frame` on the tested geometry and view state, and its own atoms and layouts, `Tooltip`, `useLeaveGuard`, `Card`, `Drawer`: [[4-software-engineering/1-projects/1-hexframe/1-app/src/front/ui/canvas/CLAUDE\|canvas]] |
| `seams/` | The seams STACK.md names in `ui/`, each one file that changes when its library comes or goes: for now the Markdown one, `CodeBlock`: [[4-software-engineering/1-projects/1-hexframe/1-app/src/front/ui/seams/CLAUDE\|seams]] |
| `gallery/` | `/design-system`, the page that shows all of it, top-down, and the frame every folder's `gallery.tsx` draws its pieces in, outside the tiers: [[4-software-engineering/1-projects/1-hexframe/1-app/src/front/ui/gallery/CLAUDE\|gallery]] |

| File | Holds |
|---|---|
| `theme.ts` | The theme's state, `useThemeState`, and `themeScript`, which paints dark before the first paint unless the user chose light. Tested |

## Rules

- **A piece's folder is its tier and its side.** A piece's side is the side of the screen it is used on, counting the features that draw each: `features/conversation/` draws the Chat, `features/system/`, `features/help/` and `features/breadcrumb/` the Canvas; the root's header, Access, Keys and the `/dev` pages are on no side, since the one screen retires them (`hexframe-app-design-system-v1/decisions.md#DEC-5`, in `.run/registers/`). A component belongs to the side it draws; an atom or a layout sits in `<side>/atoms/` or `<side>/layouts/` while one side uses it, and moves to `atoms/` or `layouts/` here once the other side uses it too. A piece whose only users are pages the one screen retires (`PageHeader`, `DataTable`) stays where it fits until its last user goes. dependency-cruiser holds the order, sides above shared layouts above shared atoms above the seams, and keeps the sides apart (`no-side-importing-the-other`, `no-layouts-importing-up`, `no-atoms-importing-up`, `no-seams-importing-up`); `scripts/lint.test.ts` proves each fires. The rule places atoms and layouts, not words: a feature of one side may still read the other side's model where a crossing carries it, as the Conversation tells a navigation in the canvas's `Gesture` (`canvas/view/`); features ignore each other already (`no-feature-importing-another`).
- **Only `ui/` imports the UI libraries**: Radix, TanStack Table, TanStack Form, the Markdown renderer, TanStack Hotkeys and Sonner; `dependency-cruiser.config.ts` says no elsewhere. No raw `<table>` or `<dialog>` outside it, and colour comes from theme tokens, never a palette name or a hex: `eslint.config.ts` says no to both. `scripts/lint.test.ts` proves those rules still fire.
- **A component takes its content as props** (`title`, `entries`, `columns`), not as a family of parts to assemble, so a feature cannot rebuild it differently. `DataTable` takes `DataColumn`s, so a feature never sees TanStack Table.
- **Dark by default, light as its equal.** The tokens and the three fonts are in `src/front/styles.css`, installed from the design system's registry, the theme's state in `theme.ts`. A token keeps shadcn's name when it means what shadcn means; the others are named for what they are in hexframe, chiefly `human` (the human's amber) and `agent` (the agent's violet), the only colours of the interface itself. `brand` is gone, and `warning` is an ember orange, so amber keeps one meaning. What each token is for: its note on `/design-system`, in `gallery/Tokens.tsx`. A new token gets a note there, a new colour a value in both themes and a line in `@theme inline` too, all of which `gallery/tokens.test.ts` checks, and a foreground if text sits on it.
- **The list grows by request.** The first one: `Button`, `Input`, `Textarea`, `Field` and `useAppForm`, `Card`, `PageHeader`, `Drawer`, `ConfirmDialog`, `DropdownMenu`, `Tooltip`, `Suggestions` (HEX-84), `Toaster`, `Skeleton`, `EmptyState`, `ErrorState`, `Forbidden`, `DataTable`, `CodeBlock`, and the canvas, `Canvas`. Then the proposals: the conversation's text, `Message`, `Thinking`, `Mention`, `Events`, `DaySplit`, `Proposal`, `Receipt`, `Act` and `Fold` (HEX-98).

