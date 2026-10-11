---
title: chat
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/front/ui/chat
owner: diplo
preview: >-
  The Chat's side of the design system, where the user and the agent act on
  the Conversation: its text, the two voices, the agent's thinking, a tile
  named, the events between them, a day's split, a Proposal and the receipt it
  leaves with its Undo; and the atoms only it uses, Suggestions, Act and Fold. Never
  imports the Canvas.
---
# chat

The Chat, the side of hexframe's screen that shows the Conversation, where the user and the agent act ([[4-software-engineering/1-projects/1-hexframe/1-app/src/front/ui/CLAUDE|ui]], "hexframe's screen, in words"). Its components come as the proposals for the chat land: the conversation's text (HEX-98) is here, the composer (HEX-99) and the widgets (HEX-100) are to come. Until the build wires them in (HEX-101), the Conversation is still drawn by `features/conversation/` from the shared pieces. The Chat never imports the Canvas (dependency-cruiser, `no-side-importing-the-other`): a piece both use moves to `ui/atoms/` or `ui/layouts/`.

Every piece takes its text as `Words` (`text/words.tsx`): plain words, a tile named, who acted by name, in the order its language says them, so a tile reads alike in a Message, an event, a Proposal's change and a receipt. A feature makes them from a message with `weave`, which reads the message with a mark in each tile's place, then weaves the tiles in where the marks landed.

| Path | Holds |
|---|---|
| `text/` | The two voices and what they name. `Message.tsx`, `Message`: the user's words in Newsreader behind an amber line, sent, sending (the line dimmed, the words grey) or failed (the line destructive, a retry); the agent's in Geist Mono behind its violet hex outline, done or streaming (each word inking in from a blur, a violet hex breathing where the next lands), a run keeping the mark on the first only; both copy their words from the edge of the column, on hover, focus or under a finger. `Thinking.tsx`, `Thinking`: live, its last three lines under "Thinking · Ns"; done, folded into "Thought for Ns", a `Fold`. `Mention.tsx`, `Mention`: a tile named, its hex and a faint underline, a button centering the canvas, a draft violet, a deleted one struck through and said so. `words.tsx`, `Words` and `Said`, the text in pieces and how it is drawn in a voice, `weave`, a message woven with its tiles, and `plainOf`, what a copy takes (`words.test.ts`: a tile woven where each language puts it, in either order, at either end, or none). `gallery.tsx`, `ChatTextGallery` |
| `entries/` | What happens between the voices. `Events.tsx`, `Events`: one line each on a thread of small hexes coloured by who acted (`Happened`, by `who`: the user amber, the agent violet, a Key hollow, hexframe faint), a navigation, a change, the live step breathing, one failed, a Turn's end; a run of reads folded into one line (`Folded`), a `Fold`. `DaySplit.tsx`, `DaySplit`: a day's name and a hairline fading toward the curve. `Proposal.tsx`, `Proposal`: open, a violet zone, its hex, kicker, title, summary and changes (`Change`), Accept in the agent's voice and Discard, asked first through `ConfirmDialog`; decided, its `Receipt`, which takes the focus when the zone had it, a status saying the decision otherwise. `Receipt.tsx`, `Receipt`: the one line a decision leaves, what was done, its Undo while one is possible, then undone, its Undo and its undoing in a live region, the time outside it, keeping the focus its Undo had. `time.tsx`, `Time`, an entry's time in the reader's language and time zone, written once hydrated, since the server knows neither. `gallery.tsx`, `ChatEntriesGallery`, each specimen drawn in the browser only, since its times are the reader's |
| `atoms/` | `Suggestions.tsx`, `Suggestions`, a list over the field it suggests for, which keeps the focus and the keys, a click in the field never closing it (`field.ts`, `inField`, tested), the field named a combobox controlling it by `suggestionsField`, the active suggestion kept in view, a click picking one; the composer's `@` search shows the Tiles in it. `controls.tsx`, the chat's controls set as text, 44px under a finger: `Act`, an action with a small hex, in the agent's or the user's voice, quiet or destructive; `Fold`, one line in the second ink that opens what it hides below it. `hex.tsx`, `HexMark`, the small hex the chat marks with, filled or hollow, pointy or flat on top, coloured as text. `gallery.tsx`, `ChatAtomsGallery`, on `/design-system` |

| File | Holds |
|---|---|
| `samples.ts` | What the galleries draw on: a few tiles of a System (`sampleTiles`), a click on one saying in a toast that the canvas would center on it, and what the user and the agent say of them (`sampleWords`), every string a message in English and French, woven with `weave` |

## Not yet

- **The widget's frame** is HEX-96's: the Proposal draws its own zone until it lands, its line drawing itself and its parts rising one after another left to the frame.
- **A tile's hover card**, and the canvas lighting a tile named in the chat, are the crossings' (HEX-96's card, HEX-108).
- **The agent's words as Markdown** wait for the seam's renderer: `Words` keeps the line breaks, not yet the emphasis, the code and the lists.
- **Editing a Message** and the Proposal's ⌘↵ wait for their features and for TanStack Hotkeys.
