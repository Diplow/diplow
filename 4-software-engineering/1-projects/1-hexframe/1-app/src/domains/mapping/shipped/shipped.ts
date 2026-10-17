// The Systems hexframe ships, which no Account owns: every Account reads them, none writes them. Two
// so far, Help, hexframe's guide, and the tutorial, a new account's first journey, each the same
// thing by its Root. Their Tiles are the folders of the app's `help/` and `tutorial/`, whose notes the
// shipped repository bundles into the server at build time, so nothing reads the file system at
// request time and nothing of them lives in the database. Each folder holds a note per language,
// `CLAUDE.md` in English and `CLAUDE.fr.md` in French, so a shipped System reads the same in both but
// for its words. A Root's id is its folder's name, `help`, `tutorial`, and every other id the path of
// slots from it, `help/3/-1`, `tutorial/2`, the same in every language, looked up among the bundled
// Tiles, never read as a file path. The build refuses a folder that reads as no Tile in either
// (vite.config.ts).
import { Effect, Schema } from 'effect'

import { noteFiles, type ShippedFolder, shippedFolders } from '#/repositories/shipped/note'
import { shippedNotes } from '#/repositories/shipped/shipped'

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

/** The Root of a System hexframe ships, its id: the name of the folder it is written in. */
export type ShippedRoot = ShippedFolder

/** The id of Help's Root. */
export const helpRoot = 'help' satisfies ShippedRoot

/** The id of the tutorial's Root. */
export const tutorialRoot = 'tutorial' satisfies ShippedRoot

/**
 * The System hexframe ships that an id names, by its Root: the Root or anything below it, well formed
 * or not, whether a Tile stands there or not; none for an id of an Account's System. A change naming
 * one is refused, so `help/../x` is Help's too.
 */
export const shippedOf = (id: string): ShippedRoot | undefined =>
  shippedFolders.find((root) => id === root || id.startsWith(`${root}/`))

/** Whether an id names a System hexframe ships, Help or the tutorial (`shippedOf`). */
export const isShippedId = (id: string) => shippedOf(id) !== undefined

/** A slot, as a shipped System's id writes it: a Child's Direction or a Context slot. */
const slot = [...directions, ...contextDirections].join('|')

/**
 * A well-formed id of the System hexframe ships from this Root, as a reader may send one: the Root,
 * then the slot of each generation below it, `help/3/-1`. The id of every Tile of it has this form;
 * not every id of this form has a Tile.
 */
const idFrom = (root: ShippedRoot) =>
  Schema.String.check(
    Schema.isMaxLength(64),
    Schema.isPattern(new RegExp(`^${root}(/(${slot}))*$`)),
  )

/** A well-formed Help id, which the MCP's reads take. */
export const HelpId = idFrom(helpRoot)

/**
 * The languages the shipped Systems are written in: English, and French beside it. The shipped
 * repository names a note's file in each, so a language added here without its notes fails the
 * typecheck.
 */
export type ShippedLanguage = 'en' | 'fr'

/** A System hexframe ships, in each language, as the build bundled it. */
const bundled = (root: ShippedRoot) => {
  const vaultIn = (language: ShippedLanguage) =>
    vaultOf(root, shippedNotes[root][language], noteFiles[language])
  return { en: vaultIn('en'), fr: vaultIn('fr') } satisfies Record<ShippedLanguage, Vault>
}

/** Each System hexframe ships, by its Root, as the build bundled it, in each language. */
export const shipped = {
  help: bundled(helpRoot),
  tutorial: bundled(tutorialRoot),
} satisfies Record<ShippedRoot, Record<ShippedLanguage, Vault>>

/**
 * A System hexframe ships, flat, in a language: owned by no Account, so `decide` refuses it every
 * change. `undefined` only for a bundle without a Root, which the build refuses.
 */
export const flatShipped = (root: ShippedRoot, language: ShippedLanguage) =>
  systemFrom(shipped[root][language].rows, { owned: false })

/**
 * A System hexframe ships, whole, in a language, as its tree: its Root with everything below it,
 * Bodies included, built from its flat System, which no Account owns, as the client builds an
 * Account's. Every visitor reads it, signed in or not, so it takes no Account.
 */
export const shippedSystem = (root: ShippedRoot, language: ShippedLanguage) =>
  Effect.suspend(() => {
    const found = flatShipped(root, language)
    return found === undefined
      ? Effect.die(new Error(`The ${root} System in ${language} was bundled without a Root`))
      : Effect.succeed(systemOf(found))
  })

/**
 * What a read from a Tile of the System hexframe ships from `root` finds, with only the fields asked,
 * in the language asked, as Mapping finds one of an Account's System: every Tile of it is at hand, so
 * it reads to any depth. An id no Tile of it has is `TileNotFound`, in every language, since they
 * share their ids.
 */
export const findInShipped = <O extends Field, F extends Field>(
  root: ShippedRoot,
  id: string,
  { fields, language }: { fields: FieldsAsked<O, F>; language: ShippedLanguage },
): Effect.Effect<Found<O, F>, TileNotFound> =>
  Effect.gen(function* () {
    const { rows: all } = shipped[root][language]
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
