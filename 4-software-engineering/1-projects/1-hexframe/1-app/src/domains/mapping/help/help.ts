// Help: the System hexframe ships, which no Account owns: every Account reads it, none writes it. Its
// Tiles are the folders of the app's `help/`, whose notes the help repository bundles into the server
// at build time, so nothing reads the file system at request time and nothing of it lives in the
// database. Its ids are paths of slots from its Root, `help`, `help/3`, `help/3/-1`, looked up among
// the bundled Tiles, never read as a file path. The build refuses a folder that reads as no Tile
// (vite.config.ts).
import { Effect } from 'effect'

import type { TileRow, TileRowWith } from '#/repositories/database/tiles/tiles'
import { helpNotes } from '#/repositories/help/help'

import { TileNotFound } from '../errors'
import { type Depth, type Field, readOf } from '../system'
import { vaultOf } from './vault'

/** The id of Help's Root; every other Help id is a path of slots below it. */
export const helpRoot = 'help'

/** Whether an id names Help: its Root or a path below it, whether a Tile stands there or not. */
export const isHelpId = (id: string) => id === helpRoot || id.startsWith(`${helpRoot}/`)

/** Help, as the build bundled it. */
export const help = vaultOf(helpRoot, helpNotes)

/** A row with only the fields asked of it, as a read from one Tile of a System gives it. */
function withFields<F extends Field>(
  { title, preview, body, ...place }: TileRow,
  fields: ReadonlyArray<F>,
): TileRowWith<F> {
  const content = { title, preview, body }
  // Built from the fields asked, so it holds exactly F's.
  const asked = Object.fromEntries(fields.map((field) => [field, content[field]])) as Pick<
    TileRow,
    F
  >
  return { ...place, content: asked }
}

/**
 * A Tile of Help read `depth` generations down with only the fields asked, and its parent, as
 * Mapping's `readTile` reads one of a System. An id no Tile of Help has is `TileNotFound`.
 */
export const readHelp = <F extends Field>(
  id: string,
  { depth, fields }: { depth: Depth; fields: ReadonlyArray<F> },
) =>
  Effect.gen(function* () {
    const opened = help.rows.find((row) => row.id === id)
    if (opened === undefined) return yield* new TileNotFound()
    const parent = help.rows.find((row) => row.id === opened.parentId)
    const rows = help.rows.map((row) => withFields(row, fields))
    return {
      tile: readOf(withFields(opened, fields), { rows, depth, pointedAt: [] }),
      parent: parent === undefined ? null : { id: parent.id, title: parent.title },
    }
  })
