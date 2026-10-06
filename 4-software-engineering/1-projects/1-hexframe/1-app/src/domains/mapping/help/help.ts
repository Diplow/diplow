// Help: the System hexframe ships, which no Account owns: every Account reads it, none writes it. Its
// Tiles are the folders of the app's `help/`, whose notes the help repository bundles into the server
// at build time, so nothing reads the file system at request time and nothing of it lives in the
// database. Each folder holds a note per language, `CLAUDE.md` in English and `CLAUDE.fr.md` in
// French, so Help reads the same in both but for its words. Its ids are paths of slots from its Root,
// `help`, `help/3`, `help/3/-1`, the same in every language, looked up among the bundled Tiles, never
// read as a file path. The build refuses a folder that reads as no Tile in either (vite.config.ts).
import { Effect, Schema } from 'effect'

import { helpNotes } from '#/repositories/help/help'
import { noteFiles } from '#/repositories/help/note'

import { TileNotFound } from '../errors'
import {
  contextDirections,
  directions,
  type Field,
  type FieldsAsked,
  type Found,
  systemFrom,
  systemOf,
  withContent,
} from '../entities'
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

/**
 * The languages Help is written in: English, and French beside it. The help repository names a note's
 * file in each, so a language added here without its notes fails the typecheck.
 */
export type HelpLanguage = 'en' | 'fr'

/** Help in one language, as the build bundled it. */
const helpIn = (language: HelpLanguage) =>
  vaultOf(helpRoot, helpNotes[language], noteFiles[language])

/** Help, as the build bundled it, in each language it is written in. */
export const help = { en: helpIn('en'), fr: helpIn('fr') } satisfies Record<HelpLanguage, Vault>

/**
 * Help whole, in a language, as its tree: its Root with everything below it, Bodies included, built
 * from Help's System, which no Account owns, as the client builds an Account's. Every visitor reads
 * it, signed in or not, so it takes no Account.
 */
export const helpSystem = (language: HelpLanguage) =>
  Effect.suspend(() => {
    const found = systemFrom(help[language].rows, { owned: false })
    return found === undefined
      ? Effect.die(new Error(`Help in ${language} was bundled without a Root`))
      : Effect.succeed(systemOf(found))
  })

/**
 * What a read from a Tile of Help finds, with only the fields asked, in the language asked, as Mapping
 * finds one of a System: every Tile of Help is at hand, so it reads to any depth. An id no Tile of
 * Help has is `TileNotFound`, in every language, since they share their ids.
 */
export const findInHelp = <O extends Field, F extends Field>(
  id: string,
  { fields, language }: { fields: FieldsAsked<O, F>; language: HelpLanguage },
): Effect.Effect<Found<O, F>, TileNotFound> =>
  Effect.gen(function* () {
    const { rows: all } = help[language]
    const opened = all.find((row) => row.id === id)
    if (opened === undefined) return yield* new TileNotFound()
    const parent = all.find((row) => row.id === opened.parentId)
    return {
      opened: withContent(opened, fields.opened),
      rows: all.map((row) => withContent(row, fields.below)),
      pointedAt: [],
      parent: parent === undefined ? null : { id: parent.id, title: parent.title },
    }
  })
