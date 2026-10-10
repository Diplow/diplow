---
title: assistant
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/domains/assistant
owner: diplo
preview: >-
  Assistant, a conversation with an agent that builds a System on the user's
  behalf. Its Conversation first: one per Account, a continuous timeline read a
  day at a time, holding the Messages, every change to the System whoever made
  it, the imports, and where the user went, consecutive navigations merged into
  one Entry. Knows no Tile; over the conversations repository. Turns, Mode and
  Proposals come next.
---
# assistant

Someone builds their System by talking to an agent instead of clicking every Tile into place. Before the agent can help, it needs to know what happened: what the user said, what changed in the System and who changed it, where the user went on the canvas. Assistant keeps that record, the **Conversation**, and it is the agent's only memory: a Turn starts afresh and reads it.

The language, as [[4-software-engineering/1-projects/1-hexframe/STACK|STACK]] first told it:

- **Conversation**: one continuous timeline per Account, added with its first Entry, read a **day** at a time, a day spanning from its reader's midnight to the next: a date of their calendar and how far their clock stands from UTC at its midnight and at the next, so the day their clock changes spans 23 or 25 hours and every instant falls on one day (`Day`, `dayAt`, `spanOf`). Earlier days stay as they were written.
- **Entry**: one moment of the timeline, oldest first, each dating from an instant. A **Message**, by the user or by the agent, trimmed, never empty, at most 10,000 characters. A **change** to the System, whoever made it: its verb, as Mapping names the event (`TileMoved`), the Tile it is about by its id and the Title it had then, the other Tile a swap traded places with or a Reference points at, and who acted. An **import**: the Tile it landed as, and how many Tiles came with it. A **navigation**: where the user went, consecutive gestures merged into one Entry.
- **Who acted**, as the timeline shows it: "you" for a write a Session made, a Key by its name for one a Key made, read when the write is recorded, and absent once that Key was revoked. The Assistant's own Turns will add "Assistant".
- **Merged navigation**: the canvas names each gesture and the Tile it was made on; the browser merges them as the user goes, by the **merge rule** (`merged`): every gesture counted, the latest twelve kept, in order. It sends the merged Entry when something else enters the timeline, a Message or a write, or when the page is hidden, never one request per gesture. A navigation keeps a Tile by its id alone; whoever reads a day joins in the Titles the System holds then.

Assistant knows no Tile. A change and an import are recorded as Mapping summarized them when they happened, never rebuilt from the System, so the timeline is a record of the past: a Tile deleted since keeps the Title it had. The API layer, which alone composes domains, hands Assistant that summary ([[4-software-engineering/1-projects/1-hexframe/1-app/src/api/assistant/CLAUDE|assistant]]). A gesture is a word of the canvas's (`center`, `show-context`) that Assistant keeps as it came, without knowing it.

| File | Holds |
|---|---|
| `assistant.ts` | The application service, Assistant's entry, which the API layer calls: `day`, the Entries of one day of the Account's Conversation, oldest first; `before`, the instant of the latest Entry before a day, where a reader scrolling back goes next, the empty days between skipped; `lastEntry`, the id of the Entry last recorded, whatever instant it dates from, a navigation dated back included, which a reader compares with the one it read to know the Conversation moved; `today`, the day a reader's clock shows now; and an operation per kind of Entry Assistant records, each shaping its own Entry in the transaction the API layer opened: `postMessage`, the user's Message; `recordNavigation`, a merged navigation, dated `ago` milliseconds before now, a day at most and never ahead; `recordChange`, a change or an import as Mapping summarized it (`Summarized`, the shape Assistant reads Mapping's summary by), with who acted |
| `assistant.test.ts` | The Conversation over the conversations repository, for real, over PGlite, on the test's clock: every kind of Entry read back as it was recorded, a day from its reader's midnight to the next, Entries of one instant in the order written, an Entry dated back a day at most and never ahead, another Account's Conversation out of reach, the latest Entry before a day across empty days and a reader's offset, and the Entry last recorded, a navigation dated back included |

| Folder | Holds |
|---|---|
| `entities/` | Assistant's entities and value objects, pure, behind `index.ts`, its door: `entry.ts`, an Entry, `EntryContent`, what it says in each of its four kinds, `Actor`, who acted, `MessageText`, `Summarized`, `Ago`, how long before it reached the server an Entry may have happened, a day at most, and `within`, a span brought within it, and `visitedTiles`, the Tiles some Entries' navigations went to; `navigation.ts`, a merged navigation, its `Step`s and the merge rule, `merged`; `day.ts`, a `Day` as its reader asks for it, `dayAt` and `spanOf`. Tested: the merge rule and what a browser may send of it (`navigation.test.ts`), the day split and the days a reader may ask for (`day.test.ts`) |

The Entries live in two tables, `conversation` and `conversation_entry`, through the conversations repository ([[4-software-engineering/1-projects/1-hexframe/1-app/src/repositories/database/CLAUDE|database]], `conversations/`). It keeps an Entry's content as Assistant encodes it, and Assistant decodes it by the same schema; one it cannot read back is a defect. Why the content is one JSON column is `hexframe-app-assistant/decisions.md#DEC-8`.

## Rules

- **The Conversation is the user's.** It is read and written for the Account the request's Session proves; a Key, which proves a program, reads and writes none of it. A change made with a Key still lands in the Conversation of the Account it acted for, labeled by the Key's name.
- **An Entry dates from when it happened.** A Message and a change date from when they were recorded; a merged navigation from its last gesture, which only the browser's clock saw, so the browser sends how long ago that was, never when, and the server's clock dates it: two clocks never disagree on the order.
- **Nothing decides yet.** Recording an Entry refuses nothing a schema has not already bounded, so Assistant has no Operations, no Decider and no errors of its own; they come with the Turn, the Mode and the Proposal.
