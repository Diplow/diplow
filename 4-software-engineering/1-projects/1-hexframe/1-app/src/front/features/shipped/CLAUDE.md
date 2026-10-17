---
title: shipped
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/front/features/shipped
owner: diplo
preview: >-
  The Systems hexframe ships on home, read-only, in the page's language, for
  anyone. Help: on the canvas signed out, or while its widget is open signed
  in, each topic's menu going somewhere only, and in the chat the agent's offer
  to read the centered topic in full, in the help widget, whose page follows
  the canvas. The tutorial: on the canvas while the URL names it, looking only.
  The view and where each is open live in the URL.
---
# shipped

What home shows of the Systems hexframe ships, each read whole through `useShipped` in the page's language (`front/client/mapping/queries.ts`, [[4-software-engineering/1-projects/1-hexframe/1-app/src/front/CLAUDE|front]]) and drawn by the canvas as one System is (`ShippedCanvas`). Help (HEX-103) is read in the help widget too (`HelpWidget`, [[4-software-engineering/1-projects/1-hexframe/1-app/src/front/ui/chat/widgets/CLAUDE|widgets]]): signed out, it is always on the canvas; signed in, it takes the canvas while the widget is open. The tutorial (HEX-117) takes the canvas while the URL names it, signed in, and nothing of it shows in the chat yet: its steps are the project's next tickets ("hexframe app: Tutorial" in Linear). The route composes both with the breadcrumb, and passes their Tiles as the canvas draws them (`canvasTree`, from the system feature). This was Help's feature, `features/help/`, until the tutorial came (`hexframe-app-tutorial/decisions.md#DEC-3`).

- **Read-only.** No empty slot takes a click and no Tile offers a swap: the canvas only changes the view, as on home; each Tile's menu holds the lines that go somewhere, Open, Go in, Show its Context and Back out, beside its hover card (the canvas's `looking`, never `acting`), so Help's Context is a right click away.
- **A topic of Help opens in the chat.** Help's Root stands alone and large on the canvas, its Preview whole, until a click opens it, and a topic centered lands with its own around it, one with none alone and large; signed out, the agent offers to read it in full under its two lines (`HelpRead`), which opens its page in the help widget, where the centered Tile's card and its Read were; signed in, `/help` opens it, on the topic the words after it find. While the widget is open, a topic centered on the canvas turns its page; the map turns the page, a topic it reads on and Open in Help center the canvas on it (`hexframe-app-design-system-v1/decisions.md#DEC-43`).
- **The tutorial stands where its param puts it.** Its Root alone and large for `true`, else the Tile it names, the one field that says where the tutorial is centered: a move on its canvas writes the Tile centered there and leaves the view's `center`, the System's, empty. Help's widget open takes the canvas from it.

| File | Holds |
|---|---|
| `Shipped.tsx` | `ShippedCanvas`, a System hexframe ships on the canvas, each Tile's menu the view's lines alone, Help's or the tutorial's, and `HelpRead`, the agent's offer to read Help's centered topic in full, a quiet act in its voice |
| `HelpWidgets.tsx` | `HelpWidgets`, the help widget on the topic the URL names |
| `nodes.ts` | `helpNodeOf`, Mapping's Tiles as the widget's topics, `readingOf`, what the widget shows of a topic: where it stands, its parent's titles and six, and where it reads on, and `topicFound`, the topic a few words after `/help` find, a title first. Pure and tested |
| `search.ts` | Home's search params of the shipped Systems, each one of their Tiles by its id, or `true`, its Root, in one schema: `help`, the help widget's topic, with `topicOf`, `withHelp`, `turnedTo`, and `fromHelpPage`, where an old link to the Help page lands; and `tutorial`, the Tile the tutorial is centered on, with `withTutorial`, `tutorialViewOf`, its view on the canvas, centered by the param, and `tutorialOn`, the params once its canvas moved. Pure and tested |

## Rules

- **The view and where each is open belong to the URL**, as on home: a link opens Help or the tutorial where its sender was, Help's widget included. A shipped System's ids are the same in every language, so switching languages keeps both.
- **Anyone reads them.** Their reads ask for no Account (`hexframe-app-mcp-server/decisions.md#DEC-19`, `#DEC-20`).
- **Leaving one gives the canvas back to the System.** While a shipped System has the canvas, the view's fields are its own, so whatever takes the canvas back takes them with it, and no Tile of Help or of the tutorial is left for the System to center: Help's Dismiss lands on the user's Root, as a link without the param does; a Tile the chat names centers the System on it; `/help` over the tutorial gives the canvas to Help, whose Dismiss lands on the Root. The corner's way back from the tutorial is HEX-119's.

## Not wired

What HEX-100 drew that the page cannot fill yet (`#DEC-43`): Ask about it, the search's list (`/help` and a few words open the first topic they find, not yet the widget's list of all of them) and the shortcuts (`?`), the page's Markdown rendered. The tutorial's command, `/tutorial`, and its steps: HEX-118 to HEX-122.
