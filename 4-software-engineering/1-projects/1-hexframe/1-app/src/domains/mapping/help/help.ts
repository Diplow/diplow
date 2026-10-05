// Help: the System hexframe ships, which no Account owns: every Account reads it, none writes it. Its
// Tiles are the folders of the app's `help/`, whose notes the help repository bundles into the server
// at build time, so nothing reads the file system at request time and nothing of it lives in the
// database. Each folder holds a note per language, `CLAUDE.md` in English and `CLAUDE.fr.md` in
// French, so Help reads the same in both but for its words. Its ids are paths of slots from its Root,
// `help`, `help/3`, `help/3/-1`, the same in every language, looked up among the bundled Tiles, never
// read as a file path. The build refuses a folder that reads as no Tile in either (vite.config.ts).
import { Effect, Schema } from 'effect'

import type { TileRow, TileRowWith } from '#/repositories/database/tiles/tiles'
import { helpNotes } from '#/repositories/help/help'
import { type Language, noteFiles } from '#/repositories/help/note'

import { TileNotFound } from '../errors'
import { type Depth, type Field, readOf, systemOf } from '../system'
import { contextDirections, directions } from '../tile'
import { type Vault, vaultOf } from './vault'

/** The id of Help's Root; every other Help id is a path of slots below it. */
export const helpRoot = 'help'

/**
 * Whether an id names Help: its Root or anything below it, well formed or not, whether a Tile stands
 * there or not. A change naming one is refused, so `help/../x` is Help's too.
 */
export const isHelpId = (id: string) => id === helpRoot || id.startsWith(`${helpRoot}/`)

/** A slot, as a Help id writes it: a Child's Direction or a Context slot. */
const slot = [...directions, ...contextDirections].join('|')

/**
 * A well-formed Help id, as a reader may send one: Help's Root, then the slot of each generation
 * below it, `help/3/-1`. The id of every Tile of Help has this form; not every id of this form has a
 * Tile.
 */
export const HelpId = Schema.String.check(
  Schema.isMaxLength(64),
  Schema.isPattern(new RegExp(`^${helpRoot}(/(${slot}))*$`)),
)

/** Help in one language, as the build bundled it. */
const helpIn = (language: Language) => vaultOf(helpRoot, helpNotes[language], noteFiles[language])

/** Help, as the build bundled it, in each language it is written in. */
export const help = { en: helpIn('en'), fr: helpIn('fr') } satisfies Record<Language, Vault>

/**
 * Help whole, in a language: its Root with everything below it, Bodies included, as `system` reads an
 * Account's System. Every visitor reads it, signed in or not, so it takes no Account.
 */
export const helpSystem = (language: Language) =>
  Effect.suspend(() => {
    const found = systemOf(help[language].rows)
    return found === undefined
      ? Effect.die(new Error(`Help in ${language} was bundled without a Root`))
      : Effect.succeed(found)
  })

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
 * Mapping's `readTile` reads one of a System, in the language asked. An id no Tile of Help has is
 * `TileNotFound`, in every language, since they share their ids.
 */
export const readHelp = <F extends Field>(
  id: string,
  { depth, fields, language }: { depth: Depth; fields: ReadonlyArray<F>; language: Language },
) =>
  Effect.gen(function* () {
    const { rows: all } = help[language]
    const opened = all.find((row) => row.id === id)
    if (opened === undefined) return yield* new TileNotFound()
    const parent = all.find((row) => row.id === opened.parentId)
    const rows = all.map((row) => withFields(row, fields))
    return {
      tile: readOf(withFields(opened, fields), { rows, depth, pointedAt: [] }),
      parent: parent === undefined ? null : { id: parent.id, title: parent.title },
    }
  })
