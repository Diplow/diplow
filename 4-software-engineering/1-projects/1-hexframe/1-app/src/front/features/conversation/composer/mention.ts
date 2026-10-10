// What the composer does with an `@`: the search it opens over the Account's Tiles by Title, as the
// user types after it; the link it inserts once one is picked, shown in the input as `@` and the Tile's
// Title; and the Message it sends, each link it inserted written as Assistant keeps it, by the Tile's id
// (`linkTo`), whatever the Tile is called by the time someone reads it. Pure; the composer's state hook
// (`../state/useMentionState.ts`) runs it.
import { linkTo } from '#/domains/assistant/entities'
import { contextSlotOf, directions, type SystemTile } from '#/domains/mapping/entities'

/** A Tile the user may `@`: its id, its Title as shown, and the Titles of the Tiles above it. */
export interface Mentionable {
  readonly id: string
  readonly title: string
  /** The Titles of its ancestors, the Root first: what tells two Tiles of one Title apart. */
  readonly trail: ReadonlyArray<string>
}

/**
 * Every Tile of a System the user may `@`, from its Root down, a generation after the other: each
 * Branch, Leaf and Context Tile, never a Reference, which is another Tile's. An untitled one, the Root
 * before its name, under `untitled`.
 */
export function mentionablesOf(root: SystemTile, untitled: string): ReadonlyArray<Mentionable> {
  const all: Mentionable[] = []
  let generation: ReadonlyArray<Found> = [
    { found: { id: root.id, title: titled(root.title, untitled), trail: [] }, tile: root },
  ]
  while (generation.length > 0) {
    all.push(...generation.map(({ found }) => found))
    generation = generation.flatMap((parent) => childrenOf(parent, untitled))
  }
  return all
}

/** A Tile found, and what stands below it, none for a Leaf. */
interface Found {
  readonly found: Mentionable
  readonly tile?: SystemTile
}

/** A Title as the composer shows it: an untitled Tile under `untitled`. */
const titled = (title: string, untitled: string) => (title === '' ? untitled : title)

/** What stands below a Tile found, Direction after Direction: its Branches, Context Tiles and Leaves. */
function childrenOf({ found, tile }: Found, untitled: string): ReadonlyArray<Found> {
  if (tile === undefined) return []
  const trail = [...found.trail, found.title]
  const of = ({ id, title }: Pick<SystemTile, 'id' | 'title'>) => ({
    id,
    title: titled(title, untitled),
    trail,
  })
  return directions.flatMap((direction) => {
    const branch = tile.branches[direction]
    const context = tile.context[contextSlotOf(direction)]
    const leaf = tile.leaves[direction]
    return [
      ...(branch === undefined ? [] : [{ found: of(branch), tile: branch }]),
      ...(context?._tag === 'Tile' ? [{ found: of(context), tile: context }] : []),
      ...(leaf === undefined ? [] : [{ found: of(leaf) }]),
    ]
  })
}

/** The `@` the caret stands after, by its index, and what was typed since. */
export interface Query {
  readonly at: number
  readonly text: string
}

/** The most characters a search reads after its `@`: past them, the user is writing, not searching. */
const longestQuery = 40

/**
 * The search the caret stands in: the last `@` before it, opening a word, with no line break since
 * and at most `longestQuery` characters typed; none otherwise.
 */
export function queryAt(value: string, caret: number): Query | undefined {
  const before = value.slice(0, caret)
  const at = before.lastIndexOf('@')
  if (at === -1 || (at > 0 && !/\s/.test(before.charAt(at - 1)))) return undefined
  const text = before.slice(at + 1)
  if (text.length > longestQuery || /[\n\r]/.test(text) || text.startsWith(' ')) return undefined
  return { at, text }
}

/** A text compared as a reader would: lower case, accents aside. */
const folded = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

/** How well a Title answers a search: starting with it, then a word starting with it, then holding it. */
function rank(title: string, text: string): number | undefined {
  const at = title.indexOf(text)
  if (at === -1) return undefined
  if (at === 0) return 0
  return /[\s\p{P}]/u.test(title.charAt(at - 1)) ? 1 : 2
}

/** The most Tiles a search offers. */
export const mostOffered = 8

/**
 * The Tiles whose Title holds what was typed, the best first, then the nearest the Root, at most
 * `mostOffered`; with nothing typed, the nearest the Root.
 */
export function matching(
  tiles: ReadonlyArray<Mentionable>,
  text: string,
): ReadonlyArray<Mentionable> {
  const typed = folded(text.trim())
  return tiles
    .flatMap((tile, order) => {
      const ranked = rank(folded(tile.title), typed)
      return ranked === undefined ? [] : [{ tile, ranked, order }]
    })
    .sort((a, b) => a.ranked - b.ranked || a.order - b.order)
    .slice(0, mostOffered)
    .map(({ tile }) => tile)
}

/** A link the composer inserted: the Tile, and how the input shows it, `@` and its Title. */
export interface Inserted {
  readonly id: string
  readonly shown: string
}

/** How the input shows a link to a Tile: `@` and its Title. */
export const shownOf = (tile: Pick<Mentionable, 'title'>) => `@${tile.title}`

/**
 * The input once a Tile is picked for a search: the `@` and what was typed after it replaced by the
 * link as it shows, and a space; and where the caret goes, after it.
 */
export function inserted(
  value: string,
  query: Query,
  tile: Pick<Mentionable, 'title'>,
): { readonly value: string; readonly caret: number } {
  const link = `${shownOf(tile)} `
  const after = value.slice(query.at + 1 + query.text.length).replace(/^ /, '')
  return { value: `${value.slice(0, query.at)}${link}${after}`, caret: query.at + link.length }
}

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * The Message the input sends: each link it inserted, wherever the input still shows it whole, written
 * by its Tile's id, the longest first so a Title another one starts with never takes its place; a
 * link the user since edited stays as they wrote it.
 */
export function encoded(value: string, links: ReadonlyArray<Inserted>): string {
  return [...links]
    .sort((a, b) => b.shown.length - a.shown.length)
    .reduce(
      (text, { id, shown }) =>
        text.replace(new RegExp(`${escaped(shown)}(?![\\p{L}\\p{N}])`, 'gu'), linkTo(id)),
      value,
    )
}
