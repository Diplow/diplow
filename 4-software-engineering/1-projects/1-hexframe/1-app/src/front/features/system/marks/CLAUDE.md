---
title: marks
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/front/features/system/marks
owner: diplo
preview: >-
  Who touches a Tile on home's canvas, and what crosses to it from the chat
  (HEX-109): a Tile named or the @ list's row lighting its Tile, a Tile
  centered glinting, the agent's light where its Turn works, what changed
  since the page opened marked until opened, and the open Proposal folded
  over the System as ghosts, rims and arcs.
---
# marks

Home's end of the crossings from the chat to the canvas, on ui's `tile/marks/` (HEX-108). The route hands `useMarksState` the System and the Turn running, tells it what the chat points at, what it centered and where the user went, and passes its `marks` to `System` and its cards to the chat. Why it reads as it does is `hexframe-app-design-system-v1/decisions.md#DEC-49`.

- **The open Proposal is folded on the client.** A day of the Conversation answers its writes as Mapping batched them (`useToday`), and `proposedOf` folds them over the System the page shows with Mapping's `fold`, reading its events. So a write that no longer applies draws nothing.
- **What changed is what the page did not hold first.** A Change recorded after today's first read, by the agent or a Key, glints once in its colour, then keeps its dot until a gesture opens or centers its Tile. A change the user's acceptance of a Proposal the page saw open made is theirs, answered one for one after the Proposal's Entry. A glint plays once: after the view changes, it doesn't rise again as its Tile remounts.
- **Its own hook, beside its rules.** `state/` holds six files already, the rule of 6's limit, and the marks are a unit of their own: what crosses from the chat, apart from the writes on their way, which `state/useWritesState.ts` marks.

| File | Holds |
|---|---|
| `proposal.ts` | `proposedOf`, pure: what the open Proposal would do, read off the events Mapping's `fold` makes of its writes. Each create is a ghost where it would stand, followed if the Proposal then moves, renames or deletes it. Each Tile already there is edited, moved or deleted, the weightiest change winning, and each move says where it lands. A swap and a Reference draw nothing |
| `marks.ts` | Pure. `acceptedOf` and `touchesOf`, the changes since the page first read today, the user's acceptance theirs. `canvasMarksOf`, the canvas's `marks`: the Tile pointed at, an arrival's glint, the agent's light, a change's glint and dot, the glints that have played left out, the Proposal's ghosts, rims and arcs. `cardOf`, what a Tile named in the chat says in its card, a ghost's where it would stand |
| `useMarksState.ts` | What the page holds of it: today beside the chat, the Entries held at the first read, the Proposals seen open, the changes opened, the glints played, the Tile pointed at and the one centered. Its actions: `point`, a name's card open or shut, `pointRow`, the `@` list's row, `arrive`, a Tile the chat centered, and `went`, a gesture on the canvas |
| `*.test.ts` | Each file's tests, the hook's over a stand-in for the Conversation's server function |
