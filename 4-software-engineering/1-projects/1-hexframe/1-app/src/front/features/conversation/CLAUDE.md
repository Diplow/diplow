---
title: conversation
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/front/features/conversation
owner: diplo
preview: >-
  The chat beside the canvas on home: the Account's Conversation read a day at
  a time, today first and each earlier day as the reader asks, its Entries
  (Messages, changes and imports by who made them, merged navigations) and the
  message input; the same timeline on fixtures at /dev/system; and the
  navigation sender, which merges the user's gestures and records them on home.
---
# conversation

What the chat beside the canvas shows: one timeline per Account, a day at a time, newest at the bottom beside the input. Home lays it out in the side column over the Account's own Conversation (`Chat`); `/dev/system` lays out the same `Conversation` on fixtures. A Message the user sends goes through the route, which posts it after the navigation it follows; nothing answers it yet, the Turn comes next, with Proposals and the Mode.

| File | Holds |
|---|---|
| `Chat.tsx` | `Chat`, home's chat: the Account's Conversation read through `useConversation` (`front/client/assistant/`), today first, and, above the oldest day shown, a button that reads the latest earlier day holding an Entry, while there is one; a skeleton until today is read, inside the route's `ReadBoundary` |
| `Conversation.tsx` | `Conversation`, the timeline: its days, oldest first, each under its label (today, yesterday, or its date in the reader's language), a day without an Entry left out, an empty state when there is nothing and nothing earlier, the button reading the day before when there is one, and the message input, which hands its route a trimmed, non-empty Message |
| `fixtures.ts` | Assistant's Entries about the fixture System, over four days counted back from now: every kind, a change by the user, by a named Key and by a revoked one, and the Titles of the Tiles its navigations went to |

| Folder | Holds |
|---|---|
| `timeline/` | The timeline's model over Assistant's Entries (`domains/assistant/entities`), pure and tested: `Day`, a date of the reader's calendar, its local midnight, whether it is today or yesterday, its Entries and the Titles of the Tiles its navigations went to (`Titles`); `dayOf`, a day the server answered as the timeline shows it; `splitByDay`, Entries split by the reader's day, for the fixtures; and `excerpt`, a long text's start, cut at a word |
| `state/` | `useNavigationSender`, mounted on home: each `Navigated` merged into the navigation under way by Assistant's merge rule, held in the page and sent as one Entry once a Message or a write to the System comes next, the page is hidden or home is left, never one request per gesture, dated back a day at most; its `postMessage` posts a Message after the navigation it follows. The navigation under way is an outbox no one renders, so it waits in a ref (`hexframe-app-assistant/decisions.md#DEC-8`). Tested: ten gestures then a Message send one navigation then the Message, a Message alone, a write, the page hiding and home left each sending the navigation under way, a new one started once sent |
| `entry/` | The Entries' views: `Entry.tsx`, one Entry: a Message, a long one shortened; a change, in the past tense, by "you", by a Key named, or by a revoked Key, naming its Tiles by the Titles they had, an untitled one "Untitled"; an import, the Tile it landed as and how many came below it; a navigation, its last gesture in the canvas's words (`Gesture`, `ui/hex/view/`) on its Tile as the System names it now, a deleted one said so, and how many gestures it merged; a verb or a gesture this page does not know yet said plainly; each with its time in the reader's language. `Shortened.tsx`, a long text's start until the reader asks for the rest |

The regroup into `timeline/` and `entry/` is `hexframe-app-assistant/decisions.md#DEC-1`; why the chat reads a day at a time, follows the poll, and says who acted in a sentence of its own is `#DEC-9`.
