// A star, found: someone, or an Organization, is named by the star of their System, its Handle the
// star's id, shown by its Title. Nobody types a UUID, so a star is found by its Title, or by a link to
// any Tile of its System, and shown by its card, its Title and Preview, which anyone sees
// (./rights/seen.ts), so two stars of one Title are told apart (HEX-130). Pure: what Mapping's star
// search takes and answers, and what the front asks by.
import { Schema } from 'effect'

/**
 * How long what is typed must be, in UTF-16 units, once trimmed, before a search runs, and the most it
 * holds: a short query would list the stars one letter at a time.
 */
const starQueryBounds = { shortest: 2, longest: 100 } as const

/** What a star search takes: a Title, or a part of one, trimmed, within `starQueryBounds`. */
export const StarQuery = Schema.String.check(
  Schema.isTrimmed(),
  Schema.isLengthBetween(starQueryBounds.shortest, starQueryBounds.longest),
)

/**
 * The query what was typed makes, trimmed, its first `longest` units alone past them, which every
 * Title holding the whole holds too; `undefined` while too short to search.
 */
export function starQueryOf(typed: string): string | undefined {
  const query = typed.trim().slice(0, starQueryBounds.longest).trim()
  return Schema.is(StarQuery)(query) ? query : undefined
}

/** The most stars a search answers: a few to choose among, not a directory. */
export const starsFoundAtMost = 6

/** A star as anyone finds it: its id, its Handle, and its card, its Title and Preview, nothing else. */
export interface StarCard {
  readonly id: string
  readonly title: string
  readonly preview: string
}

/**
 * Where a link leads, for whoever asks: to a star, by its card; to their own, which they never pick;
 * or nowhere, a link to a Tile kept from them answered as one to no Tile at all.
 */
export type LinkedStar =
  | { readonly _tag: 'Star'; readonly star: StarCard }
  | { readonly _tag: 'Own' }
  | { readonly _tag: 'Nowhere' }

/** Where a link leads that names a Tile kept from the reader, or none: nowhere, whatever kept it. */
export const nowhere: LinkedStar = { _tag: 'Nowhere' }
