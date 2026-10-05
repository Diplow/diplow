---
title: Operations
parent: 4-software-engineering/1-projects/1-hexframe/1-app/help/5-operations
owner: diplo
preview: >-
  What you can do to a System: create a Tile in a free slot, edit what it says,
  move it with everything below it, swap two Tiles, delete one with everything
  below it, and create or delete a Reference. The same operations in the app
  and through the MCP.
---
Every change to a System is one of these, in the app and through the MCP alike:

- **Create** a Tile in a free slot under another: a Child in a Direction, 1 to 6, or a Context Tile, -1 to -6.
- **Edit** a Tile: any of its Title, Preview and Body.
- **Move** a Tile, with everything below it, to a free slot elsewhere. A Tile cannot move below itself.
- **Swap** two Tiles: each takes the other's place, with everything below it. It works where no slot is free. Neither may lie below the other.
- **Delete** a Tile and everything below it. References to them stay, broken.
- **Create** or **delete** a Reference in a Context slot.

The Root, which is you, can be edited but never moved, swapped nor deleted.

Help can be read but never changed: every operation that names a Tile of Help is refused.
