// The tool table: what an agent may do to the System it works on, as data. Each entry names a tool,
// teaches it in its description, bounds its input with an Effect Schema and runs one program through
// the helper, like a server function. The MCP server (./mcp.ts) registers every entry; the Assistant
// will take the same table and run a `write` entry's program only once the user accepts its Proposal.
import { Effect, Schema } from 'effect'

import type { Field } from '#/domains/mapping/mapping'

import type { Failure } from '../../errors/failure'
import { Id } from '../../mapping/mapping'
import * as Mapping from '../../mapping/programs'
import type { Services } from '../run'

/** What a tool does to the System: reads it, or changes it. */
type ToolKind = 'read' | 'write'

/** One tool: its name and description as an agent reads them, its input, and the program it runs. */
export interface Tool<I = unknown> {
  readonly name: string
  readonly description: string
  readonly input: Schema.Decoder<I>
  readonly kind: ToolKind
  // A method, so a table of tools with different inputs is one array: each entry decodes its own.
  program(input: I): Effect.Effect<unknown, Failure, Services>
}

const tool = <I>(entry: Tool<I>) => entry

const allFields: ReadonlyArray<Field> = ['title', 'preview', 'body']
const glimpseFields: ReadonlyArray<Field> = ['title', 'preview']

/** The fields a read asks of each Tile: at least one, each once. */
const Fields = (fallback: ReadonlyArray<Field>) =>
  Schema.Array(Schema.Literals(allFields))
    .check(Schema.isMinLength(1), Schema.isUnique())
    .pipe(Schema.withDecodingDefaultKey(Effect.succeed(fallback)))

const TileId = Id.annotate({
  description: "A Tile's id, as open_tile and map answer it. Without one, the Root: the user.",
})

const directions =
  'Children say what a Tile does, keyed by Direction, 1 to 6 (NW, NE, E, SE, SW, W); its Context ' +
  'says what it is, keyed -1 to -6. A Context slot may hold a Reference instead of a Tile: ' +
  "`_tag: 'Reference'`, with the id, Title and Preview of the Tile it points at, or " +
  "`_tag: 'BrokenReference'` once that Tile is deleted."

const openTile = tool({
  name: 'open_tile',
  kind: 'read',
  description:
    "Opens one Tile of the user's System: what it says (its Title, Preview and Body, or only the " +
    'fields asked), its parent, and its Children and Context, each with its Title and Preview only. ' +
    'Without an id, opens the Root, which is the user. Read a System as its author laid it out: ' +
    "open a Tile, read its Children's Previews, then open only the ones that matter to your task. " +
    directions,
  input: Schema.Struct({
    id: Schema.optionalKey(TileId),
    fields: Fields(allFields).annotate({
      description:
        'What to read of the opened Tile: any of title, preview, body. All three when not given.',
    }),
  }),
  program: ({ id, fields }) =>
    Effect.gen(function* () {
      const opened = yield* Mapping.readTile({ id, depth: 0, fields })
      const around = yield* Mapping.readTile({
        id: opened.tile.id,
        depth: 1,
        fields: glimpseFields,
      })
      const { children = {}, context = {} } = around.tile
      return { ...opened, children, context }
    }),
})

const map = tool({
  name: 'map',
  kind: 'read',
  description:
    "Maps the user's System below a Tile, the Root when no id is given, several generations at " +
    'once: depth 0 to 3, 2 when not given, each Tile with its Title and Preview. Use it to find ' +
    'where something lives, then open_tile what matters; ask for body only when you need every ' +
    'Body below, since it costs far more. ' +
    directions,
  input: Schema.Struct({
    id: Schema.optionalKey(TileId),
    depth: Schema.Literals([0, 1, 2, 3])
      .annotate({ description: 'How many generations below the Tile: 0 to 3, 2 when not given.' })
      .pipe(Schema.withDecodingDefaultKey(Effect.succeed(2 as const))),
    fields: Fields(glimpseFields).annotate({
      description:
        'What to read of each Tile: any of title, preview, body. Title and Preview when not given.',
    }),
  }),
  program: ({ id, depth, fields }) => Mapping.readTile({ id, depth, fields }),
})

/** Every tool, in the order an agent lists them. */
export const tools: ReadonlyArray<Tool> = [openTile, map]
