// Who reaches a Tile, and from where, as its owner reads it in the Share widget: for each subject a
// System's Grants name, and Everyone, the value it has on the Tile and the Tile whose Grant gives
// it; and what the owner sets there, for Everyone so far, `inherit` removing the Tile's Grant so its
// value comes from above again. Pure: Mapping's sharing (`../../sharing/`) reads and writes the
// Grants, the front words the list.
import { Schema } from 'effect'

import { TileId } from '../tile'
import { Everyone, type GrantValue, originOn, type Sharing, type Subject } from './rights'

/**
 * A Tile's Grant as its owner sets it, for Everyone: `read`, `none`, or `inherit`, which removes the
 * Grant so the Tile's value comes from its parent again. Everyone reads at most, so neither `write`
 * nor `@` is ever offered. An Account comes with HEX-131, a Group after it.
 */
export const GrantChange = Schema.Struct({
  tile: TileId,
  subject: Everyone,
  value: Schema.Literals(['read', 'none', 'inherit']),
})
export type GrantChange = typeof GrantChange.Type

/**
 * One subject reaching a Tile: the value it has there and the Tile whose Grant gives it, the Tile
 * itself when it is set there, `null` when no Tile above sets one, the star giving `none`.
 */
export interface Reach {
  readonly subject: Subject
  readonly value: GrantValue
  readonly from: string | null
}

/** Who reaches a Tile: Everyone, always, and everyone else who does. */
export interface Reaching {
  readonly everyone: Reach
  readonly others: ReadonlyArray<Reach>
}

/**
 * Every subject that reaches a Tile, each with its value and where it comes from: Everyone, always,
 * since its owner may open the Tile to it whatever it has now; then each other subject a Grant of
 * the System names, when it has more than `none` there or a Grant set on the Tile itself, which its
 * owner may take back.
 */
export function reachOn(sharing: Sharing, tile: string): Reaching {
  const reachOf = (subject: Subject): Reach => ({ subject, ...originOn(sharing, subject, tile) })
  return {
    everyone: reachOf({ _tag: 'Everyone' }),
    others: sharing.subjects.flatMap((subject) => {
      if (subject._tag === 'Everyone') return []
      const reach = reachOf(subject)
      return reach.value !== 'none' || reach.from === tile ? [reach] : []
    }),
  }
}
