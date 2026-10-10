---
title: assistant
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/api/assistant
owner: diplo
preview: >-
  Where the client meets Assistant: a day of the Account's Conversation, a
  Message posted, a merged navigation recorded, each for the Session alone;
  and the bus subscription that records every change to a System, Mapping's
  summary of it and who acted, in the Conversation of the Account that made it.
---
# assistant

Where the client meets [[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/assistant/CLAUDE|Assistant]], and where this layer composes it with Mapping and IAM. Each server function checks its input against Assistant's own schemas, then runs its program through `run`, for the Account the request's Session proves.

| File | Holds |
|---|---|
| `assistant.ts` | The server functions, `conversationDay`, `postMessage` and `recordNavigation`, and the schemas of their inputs: `DayAsked`, a date of the reader's calendar, today when absent, and their clock's offset from UTC; `NewMessage`, Assistant's `MessageText`; `MergedNavigation`, Assistant's `Navigation` and how long ago its last gesture was, a day at most |
| `programs.ts` | The program behind each: IAM's `sessionOnly`, then, for `conversationDay`, the day's Entries and the Titles Mapping holds now of the Tiles its navigations went to, by id (`Mapping.titles`), a Tile deleted since named by none; a write recorded in the transaction it opens (`transactional`) |
| `recording.ts` | `recordedInConversation`, the bus subscription `server/run.ts` wires: each of Mapping's events, `TilesImported` included, recorded as an Entry of the acting Account's Conversation, from Mapping's own summary of it (`Mapping.summary`) and who acted, "you" for a Session, a Key by its name (IAM's `keyName`) |
| `assistant.test.ts` | The programs through `run`, on the runtime's repositories over PGlite, the bus's work waited for: a Session asked for, `SignedOut` for nobody and `SessionRequired` for a Key; a Message posted and read back today, another day empty; a navigation dated back from its last gesture, its Tiles named as the System holds them now; a write recorded beside the Messages; the errors each lists by its type; the schemas' bounds |
| `recording.test.ts` | The subscription over PGlite, Better Auth for real so a Key has a name: an edit by a Session labeled "you", a create and a move by a Key labeled by its name, a swap naming both Tiles and a delete the Title its Tile had, an import as one Entry with its count, and nothing for a write rolled back or refused |

The hooks the client calls these through are `front/client/assistant/conversation.ts`, and the browser's navigation sender `front/features/conversation/state/`: [[4-software-engineering/1-projects/1-hexframe/1-app/src/front/CLAUDE|front]].

## Rules

- **The Session alone.** Every program starts from IAM's `sessionOnly`: the Conversation is the user's, so a Key, which a server function never carries anyway, reads and writes none of it.
- **Every change lands, none waits on it.** The bus runs the subscription once the write's transaction committed, inside the request through its `waitUntil`; a rolled-back or refused write publishes nothing, so it lands nothing, and a subscription that fails is reported without touching the write it follows. A lost Entry is acceptable, as a lost event is ([[4-software-engineering/1-projects/1-hexframe/1-app/src/api/CLAUDE|api]], "The server bus").
- **Mapping summarizes, Assistant records.** Assistant knows no Tile: the subscription asks Mapping for its summary of the event, the verb and each Tile with its Title, read once the change committed, a deleted Tile's from its event, and hands it on as it came.
