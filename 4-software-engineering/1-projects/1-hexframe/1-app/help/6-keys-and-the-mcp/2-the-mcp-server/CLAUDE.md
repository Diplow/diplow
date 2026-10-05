---
title: The MCP server
parent: 4-software-engineering/1-projects/1-hexframe/1-app/help/6-keys-and-the-mcp/2-the-mcp-server
owner: diplo
preview: >-
  The tools an agent finds at /mcp: open_tile and map read a System, yours or
  Help, and a write per operation changes yours. Read as the author laid it
  out: open a Tile, read its Children's Previews, open only what matters.
---
The MCP server at `/mcp` answers an agent that sends a Key as `Authorization: Bearer <key>`.

Two tools read:

- `open_tile` opens one Tile: what it says, its parent, and its Children and Context by Title and Preview. Without an id, it opens your Root.
- `map` shows the System below a Tile, up to three generations at once, Title and Preview unless more is asked.

Both read Help too, by its ids: `open_tile({ id: "help" })` opens this guide, `map({ id: "help/3" })` maps a part of it.

The others write, one per operation: `create_tile`, `edit_tile`, `move_tile`, `swap_tiles`, `delete_tile`, `create_reference` and `delete_reference`. Each refusal comes back as a tool error that names it and says how to get past it.

Read a System as its author laid it out: open a Tile, read its Children's Previews, and open only the ones that matter to the task at hand.
