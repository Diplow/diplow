// Who belongs to an Organization, as the Members widget words it, pure: each member by their star's
// Title, one not named yet said so, keyed by their star, which a change names; and whether a star is
// among them already. IAM answers who they are (`members`); this says it in the page's language.
import type { Member } from '#/front/client/iam/organizations'
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
