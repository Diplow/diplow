// Who reaches a Tile, as the share widget words it, pure: each subject, what it may do there, and
// where that comes from, set on the Tile, on the star, on a Tile above by its Title, or nowhere, with
// what its owner chose there, Mapping's (`choiceOn`), for Everyone and for each Account, named by its
// star's Title, its star kept so a choice names it; and what a choice on a row sends, and how the
// rows show the one on its way. Mapping answers who reaches it (`reachOn`); this says it in the
// page's language.
import { Schema } from 'effect'

import {
  type Choice,
  choiceOn,
  GrantChange,
  type Reach,
  type Reaching,
  subjectKeyOf,
} from '#/domains/mapping/entities'
import { rightsSaid } from '#/front/ui/chat/widgets/share/rights'
import type { Chosen, ReachRow } from '#/front/ui/chat/widgets/share/ShareWidget'
import { m } from '#/paraglide/messages'

/** Where a Tile stands among the System's, as its rows name them. */
export interface Around {
  /** The Tile shared. */
  readonly tile: string
  /** The System's star, the user's own Tile. */
  readonly star: string
  /** A Tile's Title, by its id. */
  readonly titleOf: (id: string) => string | undefined
}

/**
 * Who a subject is, in words: Everyone, someone by their star's Title, one not named yet said so, or
 * a group, until IAM names them.
 */
function whoOf({ subject, star }: Reach) {
  switch (subject._tag) {
    case 'Everyone':
      return m.widget_share_everyone()
    case 'Account':
      if (star === undefined) return m.widget_share_account()
      return star.title === '' ? m.widget_star_untitled() : star.title
    case 'Group':
      return m.widget_share_group()
  }
}

/** Where a value comes from, in words: set here, from your star, from the Tile above, by default. */
export function fromOf(from: string | null, { tile, star, titleOf }: Around) {
  if (from === null) return m.widget_share_by_default()
  if (from === tile) return m.widget_share_set_here()
  if (from === star) return m.widget_share_from_star()
  return m.widget_share_from({ title: titleOf(from) ?? '' })
}

/** One subject reaching the Tile, as its row words it. */
const rowOf = (reach: Reach, around: Around): ReachRow => ({
  key: subjectKeyOf(reach.subject),
  who: whoOf(reach),
  value: rightsSaid(reach.value),
  from: fromOf(reach.from, around),
})

/**
 * Someone else reaching the Tile, as its row words it: an Account named by its star with what its
 * owner chose there and the star a choice names it by; anyone else, a Group, with no choice yet.
 */
export type OtherRow = ReachRow & Partial<Chosen> & { readonly star?: string }

const otherOf = (reach: Reach, around: Around): OtherRow => {
  const row = rowOf(reach, around)
  if (reach.subject._tag !== 'Account' || reach.star === undefined) return row
  return { ...row, choice: choiceOn(reach, around.tile), star: reach.star.id }
}

/**
 * Who reaches the Tile, as the share widget shows them: Everyone's row with its choice, then everyone
 * else's.
 */
export const shareRowsOf = ({ everyone, others }: Reaching, around: Around) => ({
  everyone: { ...rowOf(everyone, around), choice: choiceOn(everyone, around.tile) },
  others: others.map((reach) => otherOf(reach, around)),
})

/** The rows the share widget shows, as `shareRowsOf` words them. */
export type ShareRows = ReturnType<typeof shareRowsOf>

const isChange = Schema.is(GrantChange)

/**
 * What a choice on the row of this key sends, on the Tile: Everyone's, or the Account's by its star,
 * as Mapping's `GrantChange` takes it; none for a row no choice is sent for, a Group's, nor for a
 * choice Mapping takes for no one, Everyone's write.
 */
export function changeOf(
  { everyone, others }: ShareRows,
  tile: string,
  key: string,
  value: Choice,
): GrantChange | undefined {
  const star = others.find((row) => row.key === key)?.star
  const change =
    key === everyone.key
      ? { tile, subject: { _tag: 'Everyone' }, value }
      : star === undefined
        ? undefined
        : { tile, subject: { _tag: 'Account', star }, value }
  return isChange(change) ? change : undefined
}

/** The rows with the choice on its way, if any, shown on the row it was sent for. */
export function withSent(
  { everyone, others }: ShareRows,
  sent: GrantChange | undefined,
): ShareRows {
  if (sent === undefined) return { everyone, others }
  const { subject, value } = sent
  if (subject._tag === 'Everyone') return { everyone: { ...everyone, choice: value }, others }
  return {
    everyone,
    others: others.map((row) => (row.star === subject.star ? { ...row, choice: value } : row)),
  }
}
