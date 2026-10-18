// Who reaches a Tile, and from where, as its owner reads it in the Share widget: for each subject a
// System's Grants name, and Everyone, the value it has on the Tile and the Tile whose Grant gives
// it, an Account named by its star, a Group of an Organization's own by the name its caller gives it,
// IAM's; and what the owner sets there, for Everyone, for someone named by their star or for a Group
// by its id, `inherit` removing the Tile's Grant so its value comes from above again, and when that
// first opens the Tile to someone, which their timeline is told. Pure: Mapping's sharing
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
 * A Group a Grant is set for, by its id, a UUID, opaque to Mapping: a Group of an Organization's own
 * has no star to be named by (HEX-137). Who may name which is the API layer's to ask IAM before
 * Mapping sets it.
 */
const SomeGroup = Schema.TaggedStruct('Group', { id: Schema.String.check(Schema.isUUID()) })

/**
 * A Tile's Grant as its owner sets it, a Tile by its UUID: for Everyone, `read`, `none`, or
 * `inherit`, so neither `write` nor `@` is ever offered; for someone named by their star, or a Group
 * by its id, any `Choice`.
 */
export const GrantChange = Schema.Union([
  Schema.Struct({ tile: TileId, subject: Everyone, value: EveryoneChoice }),
  Schema.Struct({ tile: TileId, subject: Someone, value: Choice }),
  Schema.Struct({ tile: TileId, subject: SomeGroup, value: Choice }),
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
 * A Group of an Organization's own as its caller names it, IAM's: its name, and the card of its
 * Organization's star, none while it has none.
 */
export interface GroupCard {
  readonly name: string
  readonly organization: StarCard | undefined
}

/**
 * One subject reaching a Tile, named: an Account by its star's card, a Group by the card of the star
 * whose owner has its id, as an Organization's Members Group has its own (HEX-136), none for either
 * with no such star; a Group of an Organization's own by the name its caller gives it (`group`,
 * `withGroups`), or said `gone` where nobody names it any more, its Grant reaching nobody. What the
 * Share widget lists (`namedBy`).
 */
export interface NamedReach extends Reach {
  readonly star: StarCard | undefined
  readonly group?: GroupCard
  readonly gone?: true
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

/** The Groups among those reaching a Tile no star names: an Organization's own, or one gone. */
export const groupsUnnamedIn = ({ others }: Reaching<NamedReach>): ReadonlyArray<string> =>
  others.flatMap(({ subject, star }) =>
    subject._tag === 'Group' && star === undefined ? [subject.id] : [],
  )

/**
 * Who reaches a Tile once its caller named the Groups no star names, IAM's (`groupsUnnamedIn`):
 * each by its name and its Organization; one its caller knows but names not, for a reader who may
 * not see its name, left as it was; one its caller no longer knows, a deleted Group, which reaches
 * nobody, left out, but where its Grant is set on the Tile itself, said `gone`, so its owner may
 * clear it.
 */
export const withGroups = (
  { everyone, others }: Reaching<NamedReach>,
  tile: string,
  groups: ReadonlyMap<string, GroupCard | undefined>,
): Reaching<NamedReach> => ({
  everyone,
  others: others.flatMap((reach): NamedReach[] => {
    if (reach.subject._tag !== 'Group' || reach.star !== undefined) return [reach]
    const group = groups.get(reach.subject.id)
    if (group !== undefined) return [{ ...reach, group }]
    if (groups.has(reach.subject.id)) return [reach]
    return reach.from === tile ? [{ ...reach, gone: true }] : []
  }),
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
