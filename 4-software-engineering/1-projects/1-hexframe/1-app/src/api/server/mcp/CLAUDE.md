---
title: mcp
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/api/server/mcp
owner: diplo
preview: >-
  /mcp, the MCP endpoint, the API layer's other door and the one folder that
  imports the MCP server's SDK. How a Claude Code connects with a Key; the tool
  table: open_tile and map read the user's System, or Help, and a write per
  Mapping operation changes the user's, each for the Account its Bearer Key
  proves. OAuth, for clients that can't send a header, comes later.
---
# mcp

The other door into [[4-software-engineering/1-projects/1-hexframe/1-app/src/api/CLAUDE|the API layer]]: an agent reaches the user's System here, with a Key, as the browser reaches it through server functions with a Session. The rules of the door (the Bearer Key proven before the body is read, stateless JSON, the SDK imported here alone) are in that file.

| File | Holds |
|---|---|
| `mcp.ts` | `serveMcp`, which proves the Bearer Key, then hands the request to the SDK with one `McpServer` built for it, its two lines of `instructions` (what hexframe is, then `open_tile({ id: "help" })`) and every tool of the table registered with its annotations; and `methodNotAllowed`, for GET and DELETE |
| `tools.ts` | The tool table: a read, `{ name, description, input, kind: 'read', program }`, or a write, which adds its `operation` and `destructive?` |
| `testing.ts` | What the tests share: an Account signed up with a Key, an MCP client over the SDK's own transport, a System to work on |
| `mcp.test.ts` | The endpoint and the reads, over PGlite: the instructions, the tool list and its annotations, `open_tile` and `map` on the user's System and on Help, inputs refused by their schema, a Help id that climbs out included, another Account's Tile, a request no Key proves |
| `writes.test.ts` | The writes, over PGlite: each one, each refusal as a tool error, another Account's Tile, a Key revoked under a connected client |

## Connect a Claude Code

Signed in, issue a Key on `/settings/keys`. The page shows its secret once, and the command that adds hexframe to Claude Code, with this host's origin and the Key in it:

```sh
claude mcp add --transport http hexframe <origin>/mcp --header "Authorization: Bearer <key>"
```

Claude Code then lists the tools below as `mcp__hexframe__<tool>`, and the server's instructions point it at Help first. Revoking the Key on the same page cuts the agent off at its next call. Local scope, the default, keeps the Key in the user's own Claude Code config. `--scope project` writes it into the folder's `.mcp.json`, so it is for a scratch folder only, never a repo.

The tests drive the endpoint in-process. Against a real Claude Code, the acceptance is by hand, on `pnpm dev` without `DATABASE_URL`, so every Account lives in PGlite and dies with the server: sign up, issue a Key, add the server in a scratch folder (`claude mcp add --scope project` there, then `claude -p --mcp-config .mcp.json --strict-mcp-config --allowedTools mcp__hexframe`, so the user's own config stays untouched), and ask it to read Help, open the Root, then create, move, swap, edit, reference and delete; the canvas shows the result after a reload. HEX-51's pull request holds the log of the first one.

## The tools

| Tool | Kind | Does | Runs |
|---|---|---|---|
| `open_tile` | read | One Tile, the Root without an id, of the user's System or of Help, with the fields asked, its parent, and its Branches, Leaves and Context by Title and Preview | `openTile` |
| `map` | read | The System, or Help, below a Tile, 0 to 3 generations, Title and Preview unless more is asked | `readTile` |
| `create_tile` | write | A Tile in a free slot under another, never under a Leaf: a Branch, 1 to 6, a Leaf, `{ leaf: 1 }` to `{ leaf: 6 }`, or a Context Tile, −1 to −6; answers it with its id | `createTile` |
| `edit_tile` | write | Any of a Tile's Title, Preview and Body; answers the Tile as it now reads | `editTile` |
| `move_tile` | write | A Tile with everything below it, to a free slot; a Leaf grows into a Branch, and a bare Branch shrinks into a Leaf, this way | `moveTile` |
| `swap_tiles` | write | Two Tiles trade places, each with everything below it | `swapTiles` |
| `delete_tile` | write, destructive | A Tile and everything below it; References to them stay, broken | `deleteTile` |
| `create_reference` | write | A Reference to a Tile, in a free Context slot | `createReference` |
| `delete_reference` | write, destructive | Empties a Context slot that holds a Reference | `deleteReference` |

Each runs the program of `api/mapping/programs.ts` its server function runs, a write in one transaction, and takes that function's input Schema (`api/mapping/mapping.ts`) with each field described for an agent. A write that answers nothing answers `null`.

## Rules

- **A tool is an entry of the table**: a name, a description that teaches an agent when to use it, an Effect Schema for its input, which the SDK validates as a Standard Schema and lists as JSON Schema, a `kind`, `read` or `write`, and the program `run` runs for it, scoped by the tool's name. A write also names its `operation`, and is `destructive` when it erases what the user wrote; the type gives a read neither. It answers its program's value as JSON, `null` when it has none.
- **A tool is its server function, seen by an agent.** Same program, same input Schema, same Account: the one the request proves. A new Mapping operation gets its tool here, and nothing in this folder decides what the System may become.
- **A description teaches the refusals.** Each write's description names every refusal it may meet by its tag, what it means and how to get past it (a seventh Child is refused: regroup by moving), since the agent reads the tag first in the tool error. A write is built by `write`, whose `refusals` is typed by its program's errors: a refusal the operation gains, or one it loses, fails the typecheck until the description follows. Spell each record out, since a spread slips an extra line past the check.
- **A refusal comes back as a tool error**, `<tag>: <the message table's English sentence> (at fault: <fields>) (request <id>)`, the fields only for an `Invalid` one. A write words its refusals in the scope of its `operation`, its server function's name, so the message table knows the operations and never the tools: `swap_tiles` words `MovedUnderItself` as a swap, as `swapTiles` does. Its run is still scoped by the tool's name, for the logs.
- **The reads take Help's ids, the writes don't.** `open_tile` and `map` take a Tile's UUID or a Help id, `help` then up to six slots (`help/3/-1`); a write keeps its server function's UUID schema, and still teaches `HelpReadOnly`, which Mapping raises whatever reaches it (`hexframe-app-mcp-server/decisions.md#DEC-17`).
- **Annotations come from the table.** Every tool says whether it only reads (`readOnlyHint`), whether it erases what the user wrote (`destructiveHint`, the deletes alone) and that it reaches nothing but the user's System (`openWorldHint: false`).

## Later

- **OAuth, beside Keys.** A client that cannot send a header (claude.ai's connectors, a desktop app's custom connector) needs OAuth: it finds the authorization server from `/mcp`'s 401 and its protected-resource metadata, registers itself, sends the user to sign in and consent in a browser, and receives a token in place of a pasted Key. It proves an Account as a Key does, so the tools, the instructions and `run` stay as they are; IAM gains the proof and what the user consented to, and Keys stay for programs that can send a header (IAM's Key, [[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/iam/CLAUDE|iam]]).
- **A narrower Key.** A Key limited to one Tile, or to reading, comes with sharing, as IAM's language says; until then a Key acts with its Account's full power.
