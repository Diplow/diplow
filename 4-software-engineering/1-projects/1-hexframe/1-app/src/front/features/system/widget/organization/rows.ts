// Who belongs to an Organization, as the Members widget words it, pure: each member by their star's
// Title, one not named yet said so, keyed by their star, which a change names; and whether a star is
// among them already. And its Groups, as the Groups widget words them (HEX-137): each by its name and
// who is in it, keyed by its id, and the members a Group's change offers, each in it or not. IAM
// answers who they are (`members`, `groups`); this says it in the page's language.
import type { Group, Member } from '#/front/client/iam/organizations'
import type {
  GroupMemberRow,
  GroupRow,
} from '#/front/ui/chat/widgets/sharing/organization/GroupsWidget'
import type { MemberRow } from '#/front/ui/chat/widgets/sharing/organization/MembersWidget'
import { m } from '#/paraglide/messages'

/** What a member's row is keyed by while they have no star yet: nothing a change can name. */
const starless = 'starless:'

/** The members as the Members widget shows them, each keyed by their star. */
export const memberRowsOf = (members: readonly Member[]): MemberRow[] =>
  members.map(({ star, role, you }, index) => ({
    key: star?.id ?? `${starless}${String(index)}`,
    who: star === undefined || star.title === '' ? m.widget_star_untitled() : star.title,
    role,
    you,
  }))

/** The star a row's change names, none for a member who has none yet. */
export const starOfRow = (key: string) => (key.startsWith(starless) ? undefined : key)

/** Whether one of the members has this star already. */
export const isMember = (members: readonly Member[], star: string) =>
  members.some((member) => member.star?.id === star)

/** Someone by their star's Title, one untitled or with no star yet said so, the reader marked. */
const whoOf = ({ star, you }: { star: Member['star']; you: boolean }) => {
  const who = star === undefined || star.title === '' ? m.widget_star_untitled() : star.title
  return you ? m.widget_members_you({ who }) : who
}

/** The Groups as the Groups widget shows them, each by its name and who is in it, keyed by its id. */
export const groupRowsOf = (groups: readonly Group[]): GroupRow[] =>
  groups.map(({ id, name, members }) => ({
    key: id,
    name,
    who:
      members.length === 0
        ? m.widget_groups_nobody()
        : members.map(whoOf).join(m.widget_groups_joiner()),
  }))

/**
 * The Organization's members as a Group's change offers them, each keyed by their star, in the Group
 * or not; one with no star yet left out, whom no change can name.
 */
export const groupMembersOf = (members: readonly Member[], group: Group): GroupMemberRow[] =>
  members.flatMap(({ star, you }) =>
    star === undefined
      ? []
      : [
          {
            key: star.id,
            who: whoOf({ star, you }),
            in: group.members.some((one) => one.star?.id === star.id),
          },
        ],
  )

/**
 * What saving a Group's widget does with the name kept: a new Group made under it, none open yet;
 * nothing sent, the list back, for the name it has already; or that Group renamed.
 */
export type Save =
  | { readonly _tag: 'Create'; readonly name: string }
  | { readonly _tag: 'Back' }
  | { readonly _tag: 'Rename'; readonly group: string; readonly name: string }

/** What saving does, for the Group open, none for a new one, and the name kept. */
export function saveOf(
  opened: { readonly id: string; readonly name: string } | undefined,
  name: string,
): Save {
  if (opened === undefined) return { _tag: 'Create', name }
  return name === opened.name ? { _tag: 'Back' } : { _tag: 'Rename', group: opened.id, name }
}
