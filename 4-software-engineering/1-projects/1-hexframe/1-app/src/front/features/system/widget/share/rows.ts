// Who reaches a Tile, as the share widget words it, pure: each subject, what it may do there, and
// where that comes from, set on the Tile, on the star, on a Tile above by its Title, or nowhere, with
// what its owner chose there, Mapping's (`choiceOn`), for Everyone, for each Account, named by its
// star's Title, for an Organization's Members, by its star's (HEX-136), its star kept so a choice
// names it, and for a Group of an Organization's own, by its name and its Organization's, its id
// kept, or, gone, its Grant cleared alone (HEX-137); and what a choice on a row sends, and how the
// rows show the one on its way. Mapping answers who reaches it (`reachOn`), the API layer names the
// Groups (`withGroups`); this says it in the page's language.
import { Schema } from 'effect'

import {
  Choice,
  choiceOn,
  EveryoneChoice,
  GrantChange,
  type NamedReach,
  type Reach,
  type Reaching,
  rightsOf,
  subjectKeyOf,
} from '#/domains/mapping/entities'
import { rightsSaid } from '#/front/ui/chat/widgets/sharing/share/rights'
import type { Chosen, ReachRow } from '#/front/ui/chat/widgets/sharing/share/ShareWidget'
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

/** A Tile's star or Organization, in words: its Title, or untitled. */
const titleOf = (star: { readonly title: string }) =>
  star.title === '' ? m.widget_star_untitled() : star.title

/**
 * Who a subject is, in words: Everyone, someone by their star's Title, one not named yet said so, an
 * Organization's Members by its star's, a Group of its own by its name and its Organization's
 * (HEX-137), one gone said so, or a group no one names yet.
 */
function whoOf(reach: Pick<NamedReach, 'subject' | 'star' | 'group' | 'gone'>) {
  const { subject, star, group } = reach
  switch (subject._tag) {
    case 'Everyone':
      return m.widget_share_everyone()
    case 'Account':
      return star === undefined ? m.widget_share_account() : titleOf(star)
    case 'Group':
      if (star !== undefined) return m.widget_share_members({ title: titleOf(star) })
      if (group !== undefined) {
        const organization = group.organization === undefined ? '' : titleOf(group.organization)
        return m.widget_share_group_named({ name: group.name, organization })
      }
      return reach.gone === true ? m.widget_share_group_gone() : m.widget_share_group()
  }
}

/** Where a value comes from, in words: set here, from your star, from the Tile above, by default. */
export function fromOf(from: string | null, { tile, star, titleOf: titled }: Around) {
  if (from === null) return m.widget_share_by_default()
  if (from === tile) return m.widget_share_set_here()
  if (from === star) return m.widget_share_from_star()
  return m.widget_share_from({ title: titled(from) ?? '' })
}

/** One subject reaching the Tile, as its row words it. */
const rowOf = (reach: NamedReach | Reach, around: Around): ReachRow => ({
  key: subjectKeyOf(reach.subject),
  who: whoOf({ star: undefined, ...reach }),
  value: rightsSaid(rightsOf(reach.value)),
  from: fromOf(reach.from, around),
})

/**
 * Whom a row's choice names, as a `GrantChange` names them: someone, or an Organization's Members,
 * by their star; a Group of an Organization's own by its id, IAM's, a Group having no star.
 */
type Named = { readonly _tag: 'Account'; readonly star: string } | GroupNamed

type GroupNamed = { readonly _tag: 'Group'; readonly id: string }

/** Someone's row, or a Group's, with what its owner chose there and whom a choice names. */
type SomeoneRow = ReachRow & Chosen & { readonly named: Named }

/** A Group's row whose Group is gone: no choice, its Grant cleared alone. */
type GoneRow = ReachRow & { readonly clears: true; readonly named: GroupNamed }

/** Someone else reaching the Tile, as its row words it: with a choice, cleared, or neither yet. */
type OtherRow = ReachRow | SomeoneRow | GoneRow

/** Whom a row's choice names, none for a row no choice is sent for. */
const namedOf = (row: OtherRow) => ('named' in row ? row.named : undefined)

/** Whom a subject's row names, none for one with no star nor name yet. */
function namedFor(reach: NamedReach): Named | undefined {
  if (reach.subject._tag === 'Everyone') return undefined
  if (reach.star !== undefined) return { _tag: 'Account', star: reach.star.id }
  if (reach.subject._tag === 'Group' && (reach.group !== undefined || reach.gone === true)) {
    return { _tag: 'Group', id: reach.subject.id }
  }
  return undefined
}

const otherOf = (reach: NamedReach, around: Around): OtherRow => {
  const row = rowOf(reach, around)
  const named = namedFor(reach)
  if (named === undefined) return row
  if (named._tag === 'Group' && reach.gone === true) return { ...row, clears: true, named }
  return { ...row, choice: choiceOn(reach, around.tile), offered: Choice.literals, named }
}

/**
 * Who reaches the Tile, as the share widget shows them: Everyone's row with its choice, offered
 * what Mapping lets Everyone have, then everyone else's, someone or a Group offered any value, a
 * Group gone its Grant cleared.
 */
export const shareRowsOf = ({ everyone, others }: Reaching<NamedReach>, around: Around) => ({
  everyone: {
    ...rowOf(everyone, around),
    choice: choiceOn(everyone, around.tile),
    offered: EveryoneChoice.literals,
  },
  others: others.map((reach) => otherOf(reach, around)),
})

/** The rows the share widget shows, as `shareRowsOf` words them. */
export type ShareRows = ReturnType<typeof shareRowsOf>

/** Whether two rows name one subject, as a change names it. */
const sameNamed = (one: Named | undefined, other: Named) =>
  one !== undefined &&
  (one._tag === 'Account'
    ? other._tag === 'Account' && one.star === other.star
    : other._tag === 'Group' && one.id === other.id)

/** Whether one of the rows names this star already. */
export const named = ({ others }: ShareRows, star: string) =>
  others.some((row) => sameNamed(namedOf(row), { _tag: 'Account', star }))

/** Whether one of the rows names this Group of an Organization's own already. */
export const namedGroup = ({ others }: ShareRows, id: string) =>
  others.some((row) => sameNamed(namedOf(row), { _tag: 'Group', id }))

const isChange = Schema.is(GrantChange)

/**
 * What a choice on the row of this key sends, on the Tile: Everyone's, someone's by their star, or a
 * Group's by its id, as Mapping's `GrantChange` takes it; none for a row no choice is sent for, nor
 * for a choice Mapping takes for no one, Everyone's write.
 */
export function changeOf(
  { everyone, others }: ShareRows,
  tile: string,
  key: string,
  value: Choice,
): GrantChange | undefined {
  const row = others.find((other) => other.key === key)
  const subject = row === undefined ? undefined : namedOf(row)
  const change =
    key === everyone.key
      ? { tile, subject: { _tag: 'Everyone' }, value }
      : subject === undefined
        ? undefined
        : { tile, subject, value }
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
    others: others.map((row) =>
      'choice' in row && sameNamed(namedOf(row), subject) ? { ...row, choice: value } : row,
    ),
  }
}
