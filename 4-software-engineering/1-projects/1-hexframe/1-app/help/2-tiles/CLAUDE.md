---
title: Tiles
parent: 4-software-engineering/1-projects/1-hexframe/1-app/help/2-tiles
owner: diplo
preview: >-
  A Tile is the unit of a System: a Title, a Preview of at most 350 characters,
  and a Body in Markdown. The Preview is what a reader needs to decide whether
  to open the Tile, so most readers never need the Body.
---
A Tile is the unit of a System. It says three things:

- **Title**: what it is called. Never empty.
- **Preview**: at most 350 characters, counted as a reader counts them (an emoji is one). It is what a reader needs to decide whether to open the Tile. Write it so most readers won't have to.
- **Body**: everything else, in Markdown. Read only when someone opens the Tile.

The Preview does the most work. A reader skims the Previews of a Tile's Children to choose where to go, and an agent reading through the MCP sees Previews long before it asks for a Body. A good Preview names what the Tile is and what you would find inside.

Each Tile has an id. In your System it is a UUID; in Help it is a path from Help's root, like `help/2` for this Tile.
