// The Systems hexframe ships, mounted: Help and the tutorial, still read from the bundle, stand as
// Children of the Hexframe Organization's star (`hexframeStar`), each Root in a Direction of its own,
// with the stable ids they always had (`help`, `tutorial/1`), so that System reads, visits, pins and
// refuses them as any of its Tiles, every language sharing their ids (HEX-139). Nothing of them is
// written to the database: whoever reads or locks that System's rows gets them beside its own, a
// slot a mounted Root holds taken there as any. Being shipped, not a Grant, makes them read by
// Everyone and written by nobody (`rightsOn`, `decide`).
import { type Direction, hexframeStar, type Row, type ShippedRoot, shippedRoots } from '../entities'
import { shipped, type ShippedLanguage } from './shipped'

/** Where each System hexframe ships stands under the Hexframe star: Help first, then the tutorial. */
export const mountedAt = { help: 1, tutorial: 2 } as const satisfies Record<ShippedRoot, Direction>

/** The rows of every System hexframe ships in a language, each Root moved under the Hexframe star. */
const mountedIn = (language: ShippedLanguage): ReadonlyArray<Row> =>
  shippedRoots.flatMap((root) =>
    shipped[root][language].rows.map((row) =>
      row.parentId === null ? { ...row, parentId: hexframeStar, direction: mountedAt[root] } : row,
    ),
  )

/** The mounted rows, in each language, made once: the bundle never changes while the server runs. */
const mounted: Readonly<Record<ShippedLanguage, ReadonlyArray<Row>>> = {
  en: mountedIn('en'),
  fr: mountedIn('fr'),
}

/** Where a row stands, which every read of a System's rows has. */
type Placed = Pick<Row, 'id' | 'parentId'>

/**
 * A System's rows with the Systems hexframe ships mounted in it when it is the Hexframe
 * Organization's, its star among them; any other's as they are. A row of a System is read as it
 * stands, a mounted one in the language asked.
 */
export const withMounted = <R extends Placed>(
  rows: ReadonlyArray<R>,
  language: ShippedLanguage = 'en',
): ReadonlyArray<R | Row> =>
  rows.some(({ id, parentId }) => id === hexframeStar && parentId === null)
    ? [...rows, ...mounted[language]]
    : rows

/**
 * The mounted rows among these ids of the System a star names, in a language: none but for the
 * Hexframe star, under which alone a shipped Tile stands.
 */
export const mountedAmong = (
  star: string,
  ids: ReadonlyArray<string>,
  language: ShippedLanguage = 'en',
): ReadonlyArray<Row> => {
  if (star !== hexframeStar) return []
  const asked = new Set(ids)
  return mounted[language].filter(({ id }) => asked.has(id))
}
