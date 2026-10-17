// Who reaches a Tile, as the share widget words it, pure: each subject, what it may do there, and
// where that comes from, set on the Tile, on the star, on a Tile above by its Title, or nowhere; and
// what its owner set for Everyone on the Tile, which the widget's choice shows. Mapping answers who
// reaches it (`reachOn`); this says it in the page's language.
import type { GrantValue, Reach, Subject } from '#/domains/mapping/entities'
import type { ReachRow, ShareChoice } from '#/front/ui/chat/widgets/share/ShareWidget'
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

/** What a value gives, in words, its rights one after another: "read, write". */
const valueWords = (value: GrantValue) => {
  if (value === 'none') return m.widget_share_none()
  const rights = {
    read: m.widget_share_read,
    write: m.widget_share_write,
    '@': m.widget_share_agent,
  } as const
  return value
    .split('+')
    .map((right) => rights[right as keyof typeof rights]())
    .join(m.widget_share_from_joiner())
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

/** One subject's key among the rows, the same for one subject. */
const keyOf = (subject: Subject) =>
  subject._tag === 'Everyone' ? 'everyone' : `${subject._tag}:${subject.id}`

/** Where a value comes from, in words: set here, from your star, from the Tile above, by default. */
export function fromOf(from: string | null, { tile, star, titleOf }: Around) {
  if (from === null) return m.widget_share_by_default()
  if (from === tile) return m.widget_share_set_here()
  if (from === star) return m.widget_share_from_star()
  return m.widget_share_from({ title: titleOf(from) ?? '' })
}

/** One subject reaching the Tile, as its row words it. */
const rowOf = ({ subject, value, from }: Reach, around: Around): ReachRow => ({
  key: keyOf(subject),
  who: whoOf(subject),
  value: valueWords(value),
  from: fromOf(from, around),
})

/**
 * What its owner set for Everyone on the Tile: `read` or `none` where its Grant is set there, else
 * `inherit`, its value coming from above.
 */
export const choiceOf = ({ value, from }: Reach, { tile }: Pick<Around, 'tile'>): ShareChoice => {
  if (from !== tile) return 'inherit'
  return value === 'read' ? 'read' : 'none'
}

/** The everyone Mapping always lists first: none set anywhere, should it be missing. */
const nobodySet: Reach = { subject: { _tag: 'Everyone' }, value: 'none', from: null }

/**
 * Who reaches the Tile, as the share widget shows them: Everyone's row with its choice, then everyone
 * else's.
 */
export function shareRowsOf(reached: ReadonlyArray<Reach>, around: Around) {
  const everyone = reached.find(({ subject }) => subject._tag === 'Everyone') ?? nobodySet
  return {
    everyone: { ...rowOf(everyone, around), choice: choiceOf(everyone, around) },
    others: reached
      .filter(({ subject }) => subject._tag !== 'Everyone')
      .map((reach) => rowOf(reach, around)),
  }
}
