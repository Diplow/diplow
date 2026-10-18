// Who reaches a Tile, as the share widget words it, pure: each subject, what it may do there, and
// where that comes from, set on the Tile, on the star, on a Tile above by its Title, or nowhere, with
// Everyone's choice, Mapping's (`choiceOn`). Mapping answers who
// reaches it (`reachOn`); this says it in the page's language.
import {
  choiceOn,
  type GrantValue,
  type Reach,
  type Reaching,
  type Right,
  rightsOf,
  type Subject,
  subjectKeyOf,
} from '#/domains/mapping/entities'
import type { ReachRow } from '#/front/ui/chat/widgets/share/ShareWidget'
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

/** Each right, in words. */
const rightWords: Record<Right, () => string> = {
  read: m.widget_share_read,
  write: m.widget_share_write,
  '@': m.widget_share_agent,
}

/** What a value gives, in words, its rights one after another as Mapping lists them: "read, write". */
const valueWords = (value: GrantValue) => {
  const rights = rightsOf(value)
  if (rights.length === 0) return m.widget_share_none()
  return rights.map((right) => rightWords[right]()).join(m.widget_share_rights_joiner())
}

/** Who a subject is, in words: Everyone, or an account or a group, until IAM names them (HEX-131). */
function whoOf(subject: Subject) {
  switch (subject._tag) {
    case 'Everyone':
      return m.widget_share_everyone()
    case 'Account':
      return m.widget_share_account()
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
const rowOf = ({ subject, value, from }: Reach, around: Around): ReachRow => ({
  key: subjectKeyOf(subject),
  who: whoOf(subject),
  value: valueWords(value),
  from: fromOf(from, around),
})

/**
 * Who reaches the Tile, as the share widget shows them: Everyone's row with its choice, then everyone
 * else's.
 */
export const shareRowsOf = ({ everyone, others }: Reaching, around: Around) => ({
  everyone: { ...rowOf(everyone, around), choice: choiceOn(everyone, around.tile) },
  others: others.map((reach) => rowOf(reach, around)),
})
