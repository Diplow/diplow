---
title: help
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/front/features/help
owner: diplo
preview: >-
  Help on the canvas at /help, read-only, in the page's language, for anyone:
  a reader centers, expands and shows the Context as on home, and the centered
  Tile's card opens its Body in a drawer. The view and the open Body live in
  the URL.
---
# help

What `/help` shows: Help, the System hexframe ships, read whole through `useHelp` in the page's language (`front/client/mapping/queries.ts`, [[4-software-engineering/1-projects/1-hexframe/1-app/src/front/CLAUDE|front]]) and drawn by the canvas. The route composes it with the breadcrumb, and passes both Help's Tiles as the canvas draws them (`canvasTree`, from the system feature) and the Tile whose Body is open.

- **Read-only.** No empty slot takes a click and no Tile offers a swap: the canvas only changes the view, as on home.
- **A Body opens in a drawer.** The centered Tile's card holds its Title and Preview, and a button that opens its Body, shown as written, in Markdown, as home's form shows it.

| File | Holds |
|---|---|
| `search.ts` | The page's search params: the canvas's view, then `open`, the Tile whose Body is open, each field falling back on its own; `viewOf`, `withView`, which keeps the open Body, and `withOpen`, which keeps the view. Pure and tested |
| `search.test.ts` | Those search params read, a field the URL got wrong falling back alone, and each change keeping the other |
| `Help.tsx` | `HelpCanvas`, Help on the canvas, and `HelpTile`, the centered Tile's card and the drawer of the open Body |

## Rules

- **The view and the open Body belong to the URL**, as on home: a link opens Help where its sender was, the drawer included. Help's ids are the same in every language, so switching languages keeps the view.
- **Anyone reads it.** The route has no guard, and its read asks for no Account (`hexframe-app-mcp-server/decisions.md#DEC-19`, `#DEC-20`).
