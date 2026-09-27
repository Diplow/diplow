// A fixture Conversation for /dev/system, about the fixture System /dev/hex draws: three days of
// Messages, navigations and operations, every kind of entry at least once. Its days are counted back
// from `now`, so the timeline always shows a today and a yesterday. Like the System, its content is
// the user's own, so it is not translated.
import { ulysse } from '#/ui/hex/fixtures'
import { findTile } from '#/ui/hex/view/view'

import type { Entry, TileSummary } from './timeline'

function tile(id: string): TileSummary {
  const found = findTile(ulysse, id)
  if (!found) throw new Error(`The fixture System has no Tile ${id}`)
  return { id: found.id, title: found.title, preview: found.preview }
}

/** A Tile the user deleted, so no longer in the System. */
const drafts: TileSummary = {
  id: 'drafts',
  title: 'Drafts',
  preview: 'Notes not yet placed anywhere.',
}

export function conversationFixture(now: Date): Entry[] {
  const at = (daysAgo: number, hour: number, minute: number) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, hour, minute)
  // Today's entries are counted back from now, never before midnight, so none is in the future.
  const today = (minutesAgo: number) =>
    new Date(Math.max(at(0, 0, 0).getTime(), now.getTime() - minutesAgo * 60_000))
  const said = (id: string, when: Date, author: 'user' | 'agent', text: string): Entry => ({
    kind: 'message',
    id,
    at: when,
    author,
    text,
  })
  return [
    said('m1', at(3, 18, 2), 'user', 'Help me lay out my vault. I write about six domains.'),
    said(
      'm2',
      at(3, 18, 3),
      'agent',
      'Let’s start from you: Ulysse is your root. Put the six domains around it, the one you most want a reader to open first in the first direction.',
    ),
    {
      kind: 'operation',
      id: 'o1',
      at: at(3, 18, 10),
      operation: 'created',
      tile: tile('leadership'),
    },
    {
      kind: 'operation',
      id: 'o2',
      at: at(3, 18, 12),
      operation: 'created',
      tile: tile('software-engineering'),
    },
    {
      kind: 'navigation',
      id: 'n1',
      at: at(1, 21, 40),
      navigation: 'centered',
      tile: tile('software-engineering'),
    },
    {
      kind: 'navigation',
      id: 'n2',
      at: at(1, 21, 41),
      navigation: 'expanded',
      tile: tile('projects'),
    },
    { kind: 'operation', id: 'o3', at: at(1, 21, 45), operation: 'edited', tile: tile('hexframe') },
    {
      kind: 'navigation',
      id: 'n3',
      at: at(1, 21, 46),
      navigation: 'collapsed',
      tile: tile('projects'),
    },
    {
      kind: 'navigation',
      id: 'n4',
      at: at(1, 21, 47),
      navigation: 'context-shown',
      tile: tile('software-engineering'),
    },
    {
      kind: 'operation',
      id: 'o4',
      at: at(1, 21, 50),
      operation: 'moved',
      tile: tile('principles'),
    },
    {
      kind: 'navigation',
      id: 'n5',
      at: today(5),
      navigation: 'context-hidden',
      tile: tile('software-engineering'),
    },
    {
      kind: 'navigation',
      id: 'n6',
      at: today(4),
      navigation: 'centered',
      tile: tile('ulysse'),
    },
    { kind: 'operation', id: 'o5', at: today(4), operation: 'deleted', tile: drafts },
    said('m3', today(2), 'user', 'What would you add to Games?'),
    said(
      'm4',
      today(1),
      'agent',
      'Games has no Children yet. From what you wrote, I would start with three: the games you design, the ones you play, and what they teach about rules. Shall I propose them?',
    ),
  ]
}
