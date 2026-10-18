---
title: public
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/api/server/public
owner: diplo
preview: >-
  /t/<id>.md, a public Tile as Markdown, the door for anyone holding its link,
  an LLM fetching a URL among them: proven by nothing, reading as Everyone
  whoever sends it, the Tile opened as the MCP's open_tile opens it, then its
  Children and Context linked the same way; the same 404 for a Tile Everyone
  may not read as for none; never indexed, never kept by a cache.
---
# public

The door a public Tile is read through without the app: `/t/<id>.md` answers the Tile as Markdown, so any LLM that can fetch a URL reads it, and walks on to what Everyone may read below it by the links it gives (Mapping's "Later", HEX-129). The door's rule is in [[4-software-engineering/1-projects/1-hexframe/1-app/src/api/CLAUDE|api]] ("A public Tile's Markdown is a door of its own"); the route, `front/routes/t/{$id}[.]md.ts`, hands the request over whole. The canvas of `/t/<id>`, its twin for a browser, reads through the server function `publicSystem` instead ([[4-software-engineering/1-projects/1-hexframe/1-app/src/api/mapping/CLAUDE|mapping]]).

| File | Holds |
|---|---|
| `public.ts` | `servePublicTile(request, id)`: an id that is no UUID answered 404 at once; then the request's URL alone passed on, no cookie nor header, an empty Session and Key slot (`noSession`, `noKey`), and `publicTile` (`../../mapping/programs.ts`) run through `run`, so the Tile is read as Mapping's `anyone` reads it: 200 with its Markdown, `text/markdown`; 404, one sentence, for a Tile Everyone may not read, as for none; 500 with the request id for anything else. Every answer `noindex` and `no-store`. `markdownLink`, a Tile's link on the site the request reached, `/t/<id>.md`. `methodNotAllowed`, 405 for anything but GET |
| `markdown.ts` | `markdownOf(opened, link)`, pure: Mapping's `Opened` written in discovery order, as `open_tile` reads it, its Title as the heading, its Preview, its Body, then `## Children`, Branches then Leaves, each in its Directions' order, then `## Context`, a Reference by the Tile it points at, a broken one left out, each a list item, its Title linked by `link`, then its Preview, on one line; an empty part left out, an untitled Tile named so, a label's brackets escaped |
| `markdown.test.ts` | `markdownOf` on reads made by hand: the order, the links, a broken Reference left out, what is empty left out, a label kept on one line, escaped |
| `public.test.ts` | Over PGlite: `publicSystem` reading a public Tile's System from its star's card to what Everyone reads, signed out and by its owner alike, `TileNotFound` for a Tile kept from Everyone, set to none below a public one, or none; and the door writing a public Frame as Markdown, each Tile it links served the same way, the same 404 for the rest whatever cookie or Key comes along |

## Rules

- **The door reads as anyone.** It never reads a cookie, a Bearer header or any other proof, so the Markdown is the same for its owner as for a stranger: what Everyone may read. A signed-in reader sees more on the canvas of `/t/<id>`, never here.
- **What Everyone may not read does not exist here.** A Tile kept from Everyone, set to none below a public one, a star whose card is all Everyone would see, an id no Tile has and a string no UUID all answer the same 404, with the same sentence; a Tile left out below a public one leaves nothing of itself in the Markdown, not even a link.
- **Nothing keeps it.** `x-robots-tag: noindex` and `cache-control: no-store` on every answer, so nothing indexes a public Tile and a Grant removed holds from the next fetch.
- **The format is the read's, not a copy.** The door takes the Tile as `publicTile` opens it, `Mapping.openTile`, the read behind the MCP's `open_tile`, and only writes it; what is read, and what is left out, stays Mapping's. How it is laid out as Markdown, Branches before Leaves, a Reference written as the Tile it points at, "Untitled" for an empty Title, is this door's choice of delivery, as JSON is the MCP's: Mapping's `files/` writes a System's files for an export, a format of Mapping's own, which this is not.
