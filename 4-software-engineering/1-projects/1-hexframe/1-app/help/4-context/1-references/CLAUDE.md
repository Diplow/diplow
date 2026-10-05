---
title: References
parent: 4-software-engineering/1-projects/1-hexframe/1-app/help/4-context/1-references
owner: diplo
preview: >-
  A Reference puts a Tile that lives elsewhere into a Context slot, by its id,
  so it follows the Tile when it moves. If that Tile is deleted, the Reference
  shows as broken; it never blocks the delete.
---
A Reference is a link from a Context slot to another Tile of the same System. It holds the Tile's id, not a copy, so:

- when the Tile moves, the Reference still finds it;
- when the Tile changes, the Reference shows the change;
- when the Tile is deleted, the Reference stays, shown as **broken**. It never stops the delete.

A Reference shows the Title and Preview of the Tile it points at, enough for a reader to decide whether to open it.

A Reference has no place of its own beyond its slot. To put it elsewhere, delete it and create another.

Use a Reference when the same context applies to several Tiles: write it once, and refer to it from each.
