---
title: mcp
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/api/server/mcp
owner: diplo
preview: >-
  /mcp, the MCP endpoint, the API layer's other door and the one folder that
  imports the MCP server's SDK. The tool table: open_tile and map read the
  user's System, and a write per Mapping operation changes it, each for the
  Account its Bearer Key proves.
---
# mcp

The other door into [[4-software-engineering/1-projects/1-hexframe/1-app/src/api/CLAUDE|the API layer]]: an agent reaches the user's System here, with a Key, as the browser reaches it through server functions with a Session. The rules of the door (the Bearer Key proven before the body is read, stateless JSON, the SDK imported here alone) are in that file.

| File | Holds |
|---|---|
| `mcp.ts` | `serveMcp`, which proves the Bearer Key, then hands the request to the SDK with one `McpServer` built for it, every tool of the table registered with its annotations; and `methodNotAllowed`, for GET and DELETE |
| `tools.ts` | The tool table: `{ name, description, input, kind, destructive?, operation?, program }` per tool |
| `testing.ts` | What the tests share: an Account signed up with a Key, an MCP client over the SDK's own transport, a System to work on |
| `mcp.test.ts` | The endpoint and the reads, over PGlite: the tool list and its annotations, `open_tile` and `map`, inputs refused by their schema, another Account's Tile, a request no Key proves |
| `writes.test.ts` | The writes, over PGlite: each one, each refusal as a tool error, another Account's Tile, a Key revoked under a connected client |

## The tools

| Tool | Kind | Does | Runs |
|---|---|---|---|
| `open_tile` | read | One Tile, the Root without an id, with the fields asked, its parent, and its Children and Context by Title and Preview | `readTile`, twice |
| `map` | read | The System below a Tile, 0 to 3 generations, Title and Preview unless more is asked | `readTile` |
| `create_tile` | write | A Tile in a free slot under another: a Child, 1 to 6, or a Context Tile, −1 to −6; answers it with its id | `createTile` |
| `edit_tile` | write | Any of a Tile's Title, Preview and Body; answers the Tile as it now reads | `editTile` |
| `move_tile` | write | A Tile with everything below it, to a free slot | `moveTile` |
| `swap_tiles` | write | Two Tiles trade places, each with everything below it | `swapTiles` |
| `delete_tile` | write, destructive | A Tile and everything below it; References to them stay, broken | `deleteTile` |
| `create_reference` | write | A Reference to a Tile, in a free Context slot | `createReference` |
| `delete_reference` | write, destructive | Empties a Context slot that holds a Reference | `deleteReference` |

Each runs the program of `api/mapping/programs.ts` its server function runs, a write in one transaction, and takes that function's input Schema (`api/mapping/mapping.ts`) with each field described for an agent. A write that answers nothing answers `null`.

## Rules

- **A tool is an entry of the table**: a name, a description that teaches an agent when to use it, an Effect Schema for its input, which the SDK validates as a Standard Schema and lists as JSON Schema, a `kind`, `read` or `write`, `destructive` for a write that erases what the user wrote, a write's `operation`, and the program `run` runs for it, scoped by the tool's name. It answers its program's value as JSON, `null` when it has none.
- **A tool is its server function, seen by an agent.** Same program, same input Schema, same Account: the one the request proves. A new Mapping operation gets its tool here, and nothing in this folder decides what the System may become.
- **A description teaches the refusals.** Each write's description names every refusal it may meet by its tag, what it means and how to get past it (a seventh Child is refused: regroup by moving), since the agent reads the tag first in the tool error. A write is built by `write`, whose `refusals` is typed by its program's errors: a refusal the operation gains, or one it loses, fails the typecheck until the description follows. Spell each record out, since a spread slips an extra line past the check.
- **A refusal comes back as a tool error**, `<tag>: <the message table's English sentence> (at fault: <fields>) (request <id>)`, the fields only for an `Invalid` one. A write words its refusals in the scope of its `operation`, its server function's name, so the message table knows the operations and never the tools: `swap_tiles` words `MovedUnderItself` as a swap, as `swapTiles` does. Its run is still scoped by the tool's name, for the logs.
- **Annotations come from the table.** Every tool says whether it only reads (`readOnlyHint`), whether it erases what the user wrote (`destructiveHint`, the deletes alone) and that it reaches nothing but the user's System (`openWorldHint: false`).
