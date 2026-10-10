---
title: conversation
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/front/features/conversation
owner: diplo
preview: >-
  The Conversation beside the canvas: the Assistant's timeline split by day,
  its entries (Messages, navigations, operations) and the message input, on
  fixtures for now, laid out by /dev/system; and the navigation sender, which
  merges the user's gestures and records them on home.
---
# conversation

What the Conversation beside the canvas shows: one timeline per Account, split by day, newest at the bottom beside the input. It runs on fixtures for now, laid out by `/dev/system` left of the canvas; the Assistant project gives it the Account's own Conversation, its composer, Proposals and Turns.

| File | Holds |
|---|---|
| `Conversation.tsx` | `Conversation`, the timeline split by day, an empty state, and the message input, which hands its route a trimmed, non-empty Message |
| `fixtures.ts` | Three days of a Conversation about the fixture System, every kind of entry at least once, counted back from now |

| Folder | Holds |
|---|---|
| `timeline/` | The timeline's model, pure and tested: an entry is a Message, a navigation, the canvas's gesture as the `Navigated` fact carries it (`features/facts.ts`), or an operation, one of Mapping's Operations by its tag; `splitByDay`, and `excerpt`, a long Preview's start |
| `state/` | `useNavigationSender`, mounted on home: each `Navigated` merged into the navigation under way by Assistant's merge rule, held in the page and sent as one Entry once a Message or a write to the System comes next, the page is hidden or home is left, never one request per gesture, dated back a day at most; its `postMessage` posts a Message after the navigation it follows. The navigation under way is an outbox no one renders, so it waits in a ref (`hexframe-app-assistant/decisions.md#DEC-8`). Tested: ten gestures then a Message send one navigation then the Message, a Message alone, a write, the page hiding and home left each sending the navigation under way, a new one started once sent |
| `entry/` | The entries' views: `Entry.tsx`, one entry, a Message or what the user did on the canvas with its verb in the past tense, its time in the reader's language; `TileCard.tsx`, a Tile inside the Conversation, its long Preview shortened until the reader asks for the rest |

The regroup into `timeline/` and `entry/` is `hexframe-app-assistant/decisions.md#DEC-1`.
