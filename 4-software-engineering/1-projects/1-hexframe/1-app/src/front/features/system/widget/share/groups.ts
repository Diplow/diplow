// The groups the share widget offers, pure: those of each Organization the user belongs to, by its
// star's Title, its Members first, which a Grant names by its star, then each Group of its own, by
// its name, which a Grant names by its id (HEX-137); one the Tile is shared with already said so.
// IAM answers which Groups the user may name (`groupsToShareWith`); this says it in the page's
// language, and what a pick sends.
import type { GrantChange } from '#/domains/mapping/entities'
import type { ShareableGroups } from '#/front/client/iam/organizations'
import type { GroupsOf } from '#/front/ui/chat/widgets/sharing/share/GroupPicker'
import { m } from '#/paraglide/messages'

import { named, namedGroup, type ShareRows } from './rows'

/** The key an Organization's Members are offered by, which no Group's id, a UUID, ever is. */
const members = 'members'

/** What a group picked is given at first, as someone picked is: read. */
const value = 'read'

/** The groups offered, by Organization, each said shared already where a row names it. */
export const groupsOffered = (shareable: ShareableGroups, rows: ShareRows): GroupsOf[] =>
  shareable.map(({ star, groups }) => ({
    key: star.id,
    name: star.title === '' ? m.widget_star_untitled() : star.title,
    groups: [
      { key: members, name: m.widget_groups_members(), named: named(rows, star.id) },
      ...groups.map((group) => ({
        key: group.id,
        name: group.name,
        named: namedGroup(rows, group.id),
      })),
    ],
  }))

/**
 * What a pick sends, a Grant to read on the Tile: for an Organization's Members, named by its star,
 * or a Group of its own, by its id; none for a pick of nothing offered.
 */
export function groupPicked(
  shareable: ShareableGroups,
  tile: string,
  { organization, group }: { readonly organization: string; readonly group: string },
): GrantChange | undefined {
  const offered = shareable.find(({ star }) => star.id === organization)
  if (offered === undefined) return undefined
  if (group === members) return { tile, subject: { _tag: 'Account', star: organization }, value }
  return offered.groups.some(({ id }) => id === group)
    ? { tile, subject: { _tag: 'Group', id: group }, value }
    : undefined
}
