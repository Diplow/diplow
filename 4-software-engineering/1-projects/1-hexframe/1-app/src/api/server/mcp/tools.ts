// The tool table: what an agent may do to the System it works on, as data. Each entry names a tool,
// teaches it in its description, bounds its input with an Effect Schema and runs one program through
// the helper, like a server function. The MCP server (./mcp.ts) registers every entry; the Assistant
// will take the same table and run a `write` entry's program only once the user accepts its Proposal.
// A write takes its server function's input Schema (../../mapping/mapping.ts), each field described
// for an agent, and runs the same program, for the Account the Key proves, in one transaction.
import { Effect, Schema, Struct } from 'effect'

import { depths, fields as allFields, type Field } from '#/domains/mapping/mapping'

import type { Failure } from '../../errors/failure'
import {
  Id,
  NewReference,
  NewTile,
  ReferenceSlot,
  TileEdit,
  TileMove,
  TileRef,
  TileSwap,
} from '../../mapping/mapping'
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
  /** A write that erases what the user wrote, which no tool brings back: a delete. */
  readonly destructive?: true
  // A method, so a table of tools with different inputs is one array: each entry decodes its own.
  program(input: I): Effect.Effect<unknown, Failure, Services>
}

const tool = <I>(entry: Tool<I>) => entry

const glimpseFields: ReadonlyArray<Field> = ['title', 'preview']

/** The fields a read asks of each Tile: at least one, each once, these when none are given. */
const Fields = (fallback: ReadonlyArray<Field>, description: string) =>
  Schema.Array(Schema.Literals(allFields))
    .check(Schema.isMinLength(1), Schema.isUnique())
    .annotate({ description })
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
    fields: Fields(
      allFields,
      'What to read of the opened Tile: any of title, preview, body. All three when not given.',
    ),
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
    depth: Schema.Literals(depths)
      .annotate({ description: 'How many generations below the Tile: 0 to 3, 2 when not given.' })
      .pipe(Schema.withDecodingDefaultKey(Effect.succeed(2 as const))),
    fields: Fields(
      glimpseFields,
      'What to read of each Tile: any of title, preview, body. Title and Preview when not given.',
    ),
  }),
  program: ({ id, depth, fields }) => Mapping.readTile({ id, depth, fields }),
})

// The writes: one per operation of Mapping. Each description says what the tool does and, for each
// refusal it may meet, what it means and how to get past it: the agent reads the refusal's tag first
// in the tool error, then the fields at fault.

/** What each refusal means to an agent, and what to do next, by the tag the tool error starts with. */
const refusals = {
  notFound:
    'TileNotFound: no Tile of that id in the System, deleted or never there; map or open_tile ' +
    'to find the right one.',
  taken:
    'DirectionTaken: that slot already holds a Tile or a Reference; open_tile on the parent shows ' +
    'which slots are free.',
  seventh:
    'A Tile has six Children at most, so a seventh is refused: regroup some Children under a new ' +
    'one, by moving them, and the freed Directions take the rest.',
  title: 'TitleMissing: the Title is empty; give one.',
  preview: 'PreviewTooLong: the Preview is over 350 characters; shorten it.',
  root: 'RootFixed: the Root is the user; it is never moved, swapped nor deleted.',
} as const

const placement =
  'Directions 1 to 6 (NW, NE, E, SE, SW, W) hold the Children, which say what a Tile does; ' +
  '-1 to -6 hold its Context, which says what it is.'

const described = {
  id: 'The id of the Tile, as open_tile and map answer it.',
  parent: 'The id of the Tile it goes under, as open_tile and map answer it.',
  slot: "Where under the parent: a Child's Direction, 1 to 6, or a Context slot, -1 to -6. It must be free.",
  title: 'The Title: what the Tile is called, never empty.',
  preview:
    'The Preview: at most 350 characters, what a reader needs to decide whether to open the Tile.',
  body: 'The Body, in Markdown: everything else the Tile says.',
  contextSlot: 'A Context slot of the parent, -1 to -6.',
} as const

const createTile = tool({
  name: 'create_tile',
  kind: 'write',
  description:
    "Adds a Tile to the user's System, in a free slot under a Tile: a Child, or a Tile of its " +
    `Context. ${placement} Answers the new Tile, with its id. Refused with ${refusals.notFound} ` +
    `${refusals.taken} ${refusals.seventh} ${refusals.title} ${refusals.preview}`,
  input: NewTile.mapFields(
    Struct.evolve({
      parent: (field) => field.annotate({ description: described.parent }),
      slot: (field) => field.annotate({ description: described.slot }),
      title: (field) => field.annotate({ description: described.title }),
      preview: (field) => field.annotate({ description: described.preview }),
      body: (field) => field.annotate({ description: described.body }),
    }),
  ),
  program: (input) => Mapping.createTile(input),
})

const editTile = tool({
  name: 'edit_tile',
  kind: 'write',
  description:
    'Changes what a Tile says: any of its Title, its Preview and its Body, the rest left as it ' +
    "is. The Root's Title is the user's name. Answers the Tile as it now reads. Refused with " +
    `${refusals.notFound} ${refusals.title} ${refusals.preview}`,
  input: TileEdit.mapFields(
    Struct.evolve({
      id: (field) => field.annotate({ description: described.id }),
      title: (field) =>
        field.annotate({ description: `${described.title} Left as it is when not given.` }),
      preview: (field) =>
        field.annotate({ description: `${described.preview} Left as it is when not given.` }),
      body: (field) =>
        field.annotate({ description: `${described.body} Left as it is when not given.` }),
    }),
  ),
  program: (input) => Mapping.editTile(input),
})

const moveTile = tool({
  name: 'move_tile',
  kind: 'write',
  description:
    'Moves a Tile, with everything below it, to a free slot under another Tile or to another ' +
    `slot of its own parent. ${placement} References to it follow it. Answers null. Refused with ` +
    `${refusals.notFound} ${refusals.taken} ${refusals.seventh} ${refusals.root} MovedUnderItself: a Tile cannot ` +
    'move under itself or anything below it; pick a parent outside it.',
  input: TileMove.mapFields(
    Struct.evolve({
      id: (field) =>
        field.annotate({ description: `${described.id} It moves with everything below it.` }),
      parent: (field) => field.annotate({ description: described.parent }),
      slot: (field) => field.annotate({ description: described.slot }),
    }),
  ),
  program: (input) => Mapping.moveTile(input),
})

const swapTiles = tool({
  name: 'swap_tiles',
  kind: 'write',
  description:
    'Two Tiles trade places, each with everything below it: each takes the parent and slot of ' +
    'the other, a Child or a Context Tile alike, so it works where no slot is free. Answers null. ' +
    `Refused with ${refusals.notFound} ${refusals.root} MovedUnderItself: neither Tile may lie ` +
    'below the other; move one of them instead.',
  input: TileSwap.mapFields(
    Struct.evolve({
      a: (field) => field.annotate({ description: 'The id of one Tile.' }),
      b: (field) => field.annotate({ description: 'The id of the Tile it trades places with.' }),
    }),
  ),
  program: (input) => Mapping.swapTiles(input),
})

const deleteTile = tool({
  name: 'delete_tile',
  kind: 'write',
  destructive: true,
  description:
    'Deletes a Tile and everything below it, for good: no tool brings it back. References to ' +
    'any of them stay, broken. Answers null. Refused with ' +
    `${refusals.notFound} ${refusals.root}`,
  input: TileRef.mapFields(
    Struct.evolve({
      id: (field) =>
        field.annotate({ description: `${described.id} It goes with everything below it.` }),
    }),
  ),
  program: (input) => Mapping.deleteTile(input),
})

const createReference = tool({
  name: 'create_reference',
  kind: 'write',
  description:
    "Puts a Reference in a free Context slot of a Tile: a link to another Tile of the user's " +
    'System, by id, that follows it when it moves and shows broken once it is deleted. Answers ' +
    `null. Refused with ${refusals.notFound} ${refusals.taken}`,
  input: NewReference.mapFields(
    Struct.evolve({
      parent: (field) =>
        field.annotate({ description: 'The id of the Tile whose Context holds the Reference.' }),
      slot: (field) => field.annotate({ description: `${described.contextSlot} It must be free.` }),
      target: (field) =>
        field.annotate({
          description: 'The id of the Tile the Reference points at, in the same System.',
        }),
    }),
  ),
  program: (input) => Mapping.createReference(input),
})

const deleteReference = tool({
  name: 'delete_reference',
  kind: 'write',
  destructive: true,
  description:
    'Empties a Context slot holding a Reference. The Tile it pointed at is untouched; a slot ' +
    `holding a Tile, or nothing, is left as it is. Answers null. Refused with ${refusals.notFound}`,
  input: ReferenceSlot.mapFields(
    Struct.evolve({
      parent: (field) =>
        field.annotate({ description: 'The id of the Tile whose Context holds the Reference.' }),
      slot: (field) => field.annotate({ description: described.contextSlot }),
    }),
  ),
  program: (input) => Mapping.deleteReference(input),
})

/** Every tool, in the order an agent lists them: the reads, then a write per operation. */
export const tools: ReadonlyArray<Tool> = [
  openTile,
  map,
  createTile,
  editTile,
  moveTile,
  swapTiles,
  deleteTile,
  createReference,
  deleteReference,
]
