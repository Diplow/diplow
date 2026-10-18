// The groups the share widget offers, pure: those of each Organization the user belongs to, by its
// star's Title, its Members first, which a Grant names by its star, then each Group of its own, by
// its name, which a Grant names by its id (HEX-137); one the Tile is shared with already said so.
// Each is offered under the key of the subject a pick names, so a pick hands back whom it names.
// IAM answers which Groups the user may name (`groupsToShareWith`); this says it in the page's
// language, and what a pick sends.
import { type GrantChange, subjectKeyOf } from '#/domains/mapping/entities'
import type { ShareableGroups } from '#/front/client/iam/organizations'
import type { GroupsOf } from '#/front/ui/chat/widgets/sharing/share/GroupPicker'
import { m } from '#/paraglide/messages'

import { named, namedGroup, type ShareRows } from './rows'

/** The groups offered, by Organization, and what a pick of each offered key sends on a Tile. */
interface Offered {
  readonly organizations: readonly GroupsOf[]
  readonly picks: ReadonlyMap<string, (tile: string) => GrantChange>
}

/**
 * The groups offered, by Organization, each said shared already where a row names it, each under
 * the key of whom it names, a star's for the Members, a Group's as a Grant keys it, and given read on
 * the Tile when picked, as someone picked is.
 */
export function groupsOffered(shareable: ShareableGroups, rows: ShareRows): Offered {
  const picks = new Map<string, (tile: string) => GrantChange>()
  const offer = (key: string, send: (tile: string) => GrantChange) => {
    picks.set(key, send)
    return key
  }
  const organizations = shareable.map(({ star, groups }) => ({
    key: star.id,
    name: star.title === '' ? m.widget_star_untitled() : star.title,
    groups: [
      {
        key: offer(`Star:${star.id}`, (tile) => ({
          tile,
          subject: { _tag: 'Account', star: star.id },
          value: 'read',
        })),
        name: m.widget_groups_members(),
        named: named(rows, star.id),
      },
      ...groups.map(({ id, name }) => {
        const subject = { _tag: 'Group', id } as const
        return {
          key: offer(subjectKeyOf(subject), (tile) => ({ tile, subject, value: 'read' })),
          name,
          named: namedGroup(rows, id),
        }
      }),
    ],
  }))
  return { organizations, picks }
}

/** What a pick sends, a Grant to read on the Tile for whom its key names; none for no such key. */
export function groupPicked(
  { picks }: Offered,
  tile: string,
  key: string,
): GrantChange | undefined {
  return picks.get(key)?.(tile)
}
