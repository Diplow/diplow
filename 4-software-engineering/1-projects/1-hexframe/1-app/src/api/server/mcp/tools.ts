// The tool table: what an agent may do to the System it works on, as data. Each entry names a tool,
// teaches it in its description, bounds its input with an Effect Schema and runs one program through
// the helper, like a server function. The MCP server (./mcp.ts) registers every entry; the Assistant
// will take the same table and run a `write` entry's program only once the user accepts its Proposal.
// A write takes its server function's input Schema (../../mapping/mapping.ts), each field described
// for an agent, and runs the same program, for the Account the Key proves, in one transaction.
import { Effect, Schema, Struct } from 'effect'

import {
  depths,
  directions as childDirections,
  fields as allFields,
  previewLimit,
  type Field,
} from '#/domains/mapping/mapping'

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
  /**
   * The operation a write runs, by its server function's name: the scope the message table words
   * its refusals by, so the table knows the operations and never the tools.
   */
  readonly operation?: keyof typeof Mapping
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

// The writes: one per operation of Mapping. Each description says what the tool does, then, for each
// refusal its program can meet, what it means and how to get past it: the agent reads the refusal's
// tag first in the tool error, then the fields at fault.

/**
 * A line for each refusal a write's program can meet, by tag; all but `SignedOut`, which the door
 * answers before any tool runs.
 */
type Refusals<E extends Failure> = { readonly [T in Exclude<E['_tag'], 'SignedOut'>]: string }

/**
 * A write: its description, then its refusals. They are typed by its program's errors, so a refusal
 * the operation gains fails the typecheck until the description teaches it, and so does a line for
 * one it can no longer meet. Spell each record out: a spread would slip an extra line past the check.
 */
const write = <I, E extends Failure>({
  description,
  refusals,
  ...entry
}: Omit<Tool<I>, 'kind' | 'program' | 'operation'> & {
  readonly operation: keyof typeof Mapping
  readonly refusals: NoInfer<Refusals<E>>
  program: (input: I) => Effect.Effect<unknown, E, Services>
}): Tool<I> => {
  const taught = Object.entries<string>(refusals).map(([tag, line]) => `${tag}: ${line}`)
  return { ...entry, kind: 'write', description: `${description} Refused with ${taught.join(' ')}` }
}

/** What each refusal means to an agent, and what to do next, where every write says it alike. */
const refusal = {
  TileNotFound:
    'no Tile of that id in the System, deleted or never there; map or open_tile to find the ' +
    'right one.',
  DirectionTaken:
    'that slot already holds a Tile or a Reference; open_tile on the parent shows which slots ' +
    'are free.',
  TitleMissing: 'the Title is empty; give one.',
  PreviewTooLong: `the Preview is over ${String(previewLimit)} characters; shorten it.`,
  RootFixed: 'the Root is the user; it is never moved, swapped nor deleted.',
} as const

/** What a slot taken means where a Child goes: the regrouping a seventh Child asks for. */
const takenChild =
  `${refusal.DirectionTaken} A Tile has ${String(childDirections.length)} Children at most, so ` +
  'one more is refused: regroup some Children under a new one, by moving them, and the freed ' +
  'Directions take the rest.'

const placement =
  'Directions 1 to 6 (NW, NE, E, SE, SW, W) hold the Children, which say what a Tile does; ' +
  '-1 to -6 hold its Context, which says what it is.'

const described = {
  id: 'The id of the Tile, as open_tile and map answer it.',
  parent: 'The id of the Tile it goes under, as open_tile and map answer it.',
  slot: "Where under the parent: a Child's Direction, 1 to 6, or a Context slot, -1 to -6. It must be free.",
  title: 'The Title: what the Tile is called, never empty.',
  preview:
    `The Preview: at most ${String(previewLimit)} characters, what a reader needs to decide ` +
    'whether to open the Tile.',
  body: 'The Body, in Markdown: everything else the Tile says.',
  contextSlot: 'A Context slot of the parent, -1 to -6.',
  holder: 'The id of the Tile whose Context holds the Reference.',
} as const

const createTile = write({
  name: 'create_tile',
  operation: 'createTile',
  description:
    "Adds a Tile to the user's System, in a free slot under a Tile: a Child, or a Tile of its " +
    `Context. ${placement} Answers the new Tile, with its id.`,
  refusals: {
    TileNotFound: refusal.TileNotFound,
    DirectionTaken: takenChild,
    TitleMissing: refusal.TitleMissing,
    PreviewTooLong: refusal.PreviewTooLong,
  },
  input: NewTile.mapFields(
    Struct.evolve({
      parent: (field) => field.annotate({ description: described.parent }),
      slot: (field) => field.annotate({ description: described.slot }),
      title: (field) => field.annotate({ description: described.title }),
      preview: (field) => field.annotate({ description: described.preview }),
      body: (field) => field.annotate({ description: described.body }),
    }),
  ),
  program: Mapping.createTile,
})

const editTile = write({
  name: 'edit_tile',
  operation: 'editTile',
  description:
    'Changes what a Tile says: any of its Title, its Preview and its Body, the rest left as it ' +
    "is. The Root's Title is the user's name. Answers the Tile as it now reads.",
  refusals: {
    TileNotFound: refusal.TileNotFound,
    TitleMissing: refusal.TitleMissing,
    PreviewTooLong: refusal.PreviewTooLong,
  },
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
  program: Mapping.editTile,
})

const moveTile = write({
  name: 'move_tile',
  operation: 'moveTile',
  description:
    'Moves a Tile, with everything below it, to a free slot under another Tile or to another ' +
    `slot of its own parent. ${placement} References to it follow it. Answers null.`,
  refusals: {
    TileNotFound: refusal.TileNotFound,
    DirectionTaken: takenChild,
    RootFixed: refusal.RootFixed,
    MovedUnderItself:
      'a Tile cannot move under itself or anything below it; pick a parent outside it.',
  },
  input: TileMove.mapFields(
    Struct.evolve({
      id: (field) =>
        field.annotate({ description: `${described.id} It moves with everything below it.` }),
      parent: (field) => field.annotate({ description: described.parent }),
      slot: (field) => field.annotate({ description: described.slot }),
    }),
  ),
  program: Mapping.moveTile,
})

const swapTiles = write({
  name: 'swap_tiles',
  operation: 'swapTiles',
  description:
    'Two Tiles trade places, each with everything below it: each takes the parent and slot of ' +
    'the other, a Child or a Context Tile alike, so it works where no slot is free. Answers null.',
  refusals: {
    TileNotFound: refusal.TileNotFound,
    RootFixed: refusal.RootFixed,
    MovedUnderItself: 'neither Tile may lie below the other; move one of them instead.',
  },
  input: TileSwap.mapFields(
    Struct.evolve({
      a: (field) => field.annotate({ description: 'The id of one Tile.' }),
      b: (field) => field.annotate({ description: 'The id of the Tile it trades places with.' }),
    }),
  ),
  program: Mapping.swapTiles,
})

const deleteTile = write({
  name: 'delete_tile',
  operation: 'deleteTile',
  destructive: true,
  description:
    'Deletes a Tile and everything below it, for good: no tool brings it back. References to ' +
    'any of them stay, broken. Answers null.',
  refusals: { TileNotFound: refusal.TileNotFound, RootFixed: refusal.RootFixed },
  input: TileRef.mapFields(
    Struct.evolve({
      id: (field) =>
        field.annotate({ description: `${described.id} It goes with everything below it.` }),
    }),
  ),
  program: Mapping.deleteTile,
})

const createReference = write({
  name: 'create_reference',
  operation: 'createReference',
  description:
    "Puts a Reference in a free Context slot of a Tile: a link to another Tile of the user's " +
    'System, by id, that follows it when it moves and shows broken once it is deleted. Answers ' +
    'null.',
  refusals: { TileNotFound: refusal.TileNotFound, DirectionTaken: refusal.DirectionTaken },
  input: NewReference.mapFields(
    Struct.evolve({
      parent: (field) => field.annotate({ description: described.holder }),
      slot: (field) => field.annotate({ description: `${described.contextSlot} It must be free.` }),
      target: (field) =>
        field.annotate({
          description: 'The id of the Tile the Reference points at, in the same System.',
        }),
    }),
  ),
  program: Mapping.createReference,
})

const deleteReference = write({
  name: 'delete_reference',
  operation: 'deleteReference',
  destructive: true,
  description:
    'Empties a Context slot holding a Reference. The Tile it pointed at is untouched; a slot ' +
    'holding a Tile, or nothing, is left as it is. Answers null.',
  refusals: { TileNotFound: refusal.TileNotFound },
  input: ReferenceSlot.mapFields(
    Struct.evolve({
      parent: (field) => field.annotate({ description: described.holder }),
      slot: (field) => field.annotate({ description: described.contextSlot }),
    }),
  ),
  program: Mapping.deleteReference,
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
