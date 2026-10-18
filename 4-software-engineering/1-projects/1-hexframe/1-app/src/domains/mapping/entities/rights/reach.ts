// Who reaches a Tile, and from where, as its owner reads it in the Share widget: for each subject a
// System's Grants name, and Everyone, the value it has on the Tile and the Tile whose Grant gives
// it, an Account named by its star; and what the owner sets there, for Everyone or for someone named
// by their star, `inherit` removing the Tile's Grant so its value comes from above again, and when
// that first opens the Tile to someone, which their timeline is told. Pure: Mapping's sharing
// (`../../sharing/`) reads and writes the Grants, the front words the list.
import { Schema } from 'effect'

import type { StarCard } from '../star'
import { TileId } from '../tile'
import { Everyone, GrantValue, originOn, Reading, type Sharing, type Subject } from './rights'

/** What the owner sets on a Tile for Everyone: `read`, `none`, or `inherit`. Never more than read. */
export const EveryoneChoice = Schema.Literals(['read', 'none', 'inherit'])

/**
 * What the owner sets on a Tile for someone: any value, `none` to `read+write+@`, or `inherit`,
 * which removes the Tile's Grant so the value comes from the Tile above again.
 */
export const Choice = Schema.Literals([...GrantValue.literals, 'inherit'])
export type Choice = typeof Choice.Type

/**
 * Someone a Grant is set for, as its owner names them: by their star, their Handle, its id, never by
 * an id of IAM's, which nobody types (HEX-130). Mapping finds the Account it stands for.
 */
const Someone = Schema.TaggedStruct('Account', { star: TileId })

/**
 * A Tile's Grant as its owner sets it, a Tile by its UUID: for Everyone, `read`, `none`, or
 * `inherit`, so neither `write` nor `@` is ever offered; for someone named by their star, any
 * `Choice`. A Group comes after.
 */
export const GrantChange = Schema.Union([
  Schema.Struct({ tile: TileId, subject: Everyone, value: EveryoneChoice }),
  Schema.Struct({ tile: TileId, subject: Someone, value: Choice }),
])
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

/**
 * One subject reaching a Tile, named: an Account by its star's card, a Group by the card of the star
 * whose owner has its id, as an Organization's Members Group has its own (HEX-136), none for either
 * with no such star, a Group IAM names otherwise included, which comes later. What the Share widget
 * lists (`namedBy`).
 */
export interface NamedReach extends Reach {
  readonly star: StarCard | undefined
}

/**
 * What a subject's value on a Tile reads as the owner's choice there, `GrantChange`'s inverse: its
 * value where its Grant is set on the Tile, else `inherit`.
 */
export const choiceOn = ({ value, from }: Reach, tile: string): Choice =>
  from === tile ? value : 'inherit'

/** Who reaches a Tile: Everyone, always, and everyone else who does, named or not yet. */
export interface Reaching<Other extends Reach = Reach> {
  readonly everyone: Reach
  readonly others: ReadonlyArray<Other>
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

/** The Accounts and Groups reaching a Tile, by id, which stars may name. */
export const namedIn = ({ others }: Reaching): ReadonlyArray<string> =>
  others.flatMap(({ subject }) => (subject._tag === 'Everyone' ? [] : [subject.id]))

/**
 * Who reaches a Tile, each Account named by its star, by the owner it stands for, and each Group by
 * the star of the owner of its id, when there is one.
 */
export const namedBy = (
  { everyone, others }: Reaching,
  stars: ReadonlyMap<string, StarCard>,
): Reaching<NamedReach> => ({
  everyone,
  others: others.map((reach) => ({
    ...reach,
    star: reach.subject._tag === 'Everyone' ? undefined : stars.get(reach.subject.id),
  })),
})

const reads = Schema.is(Reading)

/**
 * Whether a choice opens the Tile to its subject by a Grant of its own: before it, the Tile set
 * nothing for them; after it, it lets them read, or more. What tells someone a Tile was shared with
 * them, once per Grant: any change of a Grant set there already says nothing, `none` to `read`
 * included, so toggling a value never tells again, nor does `none`, nor `inherit`, whatever the Tile
 * above gives. A Grant removed then set again is a share of its own.
 */
export const opens = (before: Reach, tile: string, choice: Choice): choice is Reading =>
  reads(choice) && choiceOn(before, tile) === 'inherit'
