---
title: help
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/front/features/help
owner: diplo
preview: >-
  Help on home, read-only, in the page's language, for anyone: on the canvas,
  signed out, or while its widget is open signed in, each topic's menu going
  somewhere only, and in the chat the agent's offer to read the centered topic
  in full, in the help widget, whose page follows the canvas. The view and the
  topic open live in the URL.
---
# help

What home shows of Help (HEX-103): Help, the System hexframe ships, read whole through `useHelp` in the page's language (`front/client/mapping/queries.ts`, [[4-software-engineering/1-projects/1-hexframe/1-app/src/front/CLAUDE|front]]), drawn by the canvas and read in the help widget (`HelpWidget`, [[4-software-engineering/1-projects/1-hexframe/1-app/src/front/ui/chat/widgets/CLAUDE|widgets]]). Signed out, Help is always on the canvas; signed in, it takes the canvas while the widget is open. The route composes it with the breadcrumb, and passes Help's Tiles as the canvas draws them (`canvasTree`, from the system feature).

- **Read-only.** No empty slot takes a click and no Tile offers a swap: the canvas only changes the view, as on home; each topic's menu holds the lines that go somewhere, Open, Go in, Show its Context and Back out, beside its hover card (the canvas's `looking`), so Help's Context is a right click away.
- **A topic opens in the chat.** Help's Root stands alone and large on the canvas, its Preview whole, until a click opens it, and a topic centered lands with its own around it, one with none alone and large; signed out, the agent offers to read it in full under its two lines (`HelpRead`), which opens its page in the help widget, where the centered Tile's card and its Read were; signed in, `/help` opens it, on the topic the words after it find. While the widget is open, a topic centered on the canvas turns its page; the map turns the page, a topic it reads on and Open in Help center the canvas on it (`hexframe-app-design-system-v1/decisions.md#DEC-43`).

| File | Holds |
|---|---|
| `Help.tsx` | `HelpCanvas`, Help on the canvas, each topic's menu the view's lines alone, and `HelpRead`, the agent's offer to read the centered topic in full, a quiet act in its voice |
| `HelpWidgets.tsx` | `HelpWidgets`, the help widget on the topic the URL names |
| `nodes.ts` | `helpNodeOf`, Mapping's Tiles as the widget's topics, `readingOf`, what the widget shows of a topic: where it stands, its parent's titles and six, and where it reads on, and `topicFound`, the topic a few words after `/help` find, a title first. Pure and tested |
| `search.ts` | `help`, home's search param: the topic open, by its id, or `true`, Help's Root; `topicOf`, `withHelp`, and `fromHelpPage`, where an old link to the Help page lands. Pure and tested |

## Rules

- **The view and the topic belong to the URL**, as on home: a link opens Help where its sender was, the widget included. Help's ids are the same in every language, so switching languages keeps both.
- **Anyone reads it.** Its read asks for no Account (`hexframe-app-mcp-server/decisions.md#DEC-19`, `#DEC-20`).

## Not wired

What HEX-100 drew that the page cannot fill yet (`#DEC-43`): Ask about it, the search's list (`/help` and a few words open the first topic they find, not yet the widget's list of all of them) and the shortcuts (`?`), the page's Markdown rendered.
