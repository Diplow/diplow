// A fixture Conversation for /dev/system, about the fixture System /dev/hex draws: four days of
// Assistant's Entries, every kind at least once, a change by each kind of actor, and the Titles of the
// Tiles its navigations went to. Its days are counted back from `now`, so the timeline always shows a
// today and a yesterday. Like the System, its content is the user's own, so it is not translated.
import type { Entry } from '#/domains/assistant/entities'
import { ulysse } from '#/front/ui/hex/fixtures'
import { findTile } from '#/front/ui/hex/view/tiles'

import type { Titles } from './timeline/timeline'

/** A Tile of the fixture System, as a change names it. */
function tile(id: string) {
  const found = findTile(ulysse, id)
  if (!found) throw new Error(`The fixture System has no Tile ${id}`)
  return { id: found.id, title: found.title }
}

/** A Tile the user deleted, so no longer in the System. */
const drafts = { id: 'drafts', title: 'Drafts' }

const you = { _tag: 'You' } as const

export function conversationFixture(now: Date): { entries: Entry[]; titles: Titles } {
  const at = (daysAgo: number, hour: number, minute: number) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, hour, minute)
  // Today's entries are counted back from now, never before midnight, so none is in the future.
  const today = (minutesAgo: number) =>
    new Date(Math.max(at(0, 0, 0).getTime(), now.getTime() - minutesAgo * 60_000))
  const said = (id: string, when: Date, author: 'user' | 'agent', text: string): Entry => ({
    _tag: 'Message',
    id,
    at: when,
    author,
    text,
  })
  const titles = Object.fromEntries(
    ['software-engineering', 'projects', 'ulysse'].map((id) => [id, tile(id).title]),
  )
  const entries: Entry[] = [
    {
      _tag: 'Import',
      id: 'i1',
      at: at(5, 9, 30),
      tile: tile('ulysse'),
      count: 14,
      actor: you,
    },
    said('m1', at(3, 18, 2), 'user', 'Help me lay out my vault. I write about six domains.'),
    said(
      'm2',
      at(3, 18, 3),
      'agent',
      'Let’s start from you: Ulysse is your root. Put the six domains around it, the one you most want a reader to open first in the first direction.',
    ),
    {
      _tag: 'Change',
      id: 'c1',
      at: at(3, 18, 10),
      verb: 'TileCreated',
      tile: tile('leadership'),
      actor: you,
    },
    {
      _tag: 'Change',
      id: 'c2',
      at: at(3, 18, 12),
      verb: 'TileCreated',
      tile: tile('software-engineering'),
      actor: { _tag: 'Key', name: 'Claude Code' },
    },
    {
      _tag: 'Navigation',
      id: 'n1',
      at: at(1, 21, 41),
      steps: [
        { gesture: 'center', tile: 'software-engineering' },
        { gesture: 'expand', tile: 'projects' },
      ],
      gestures: 2,
    },
    {
      _tag: 'Change',
      id: 'c3',
      at: at(1, 21, 45),
      verb: 'TileEdited',
      tile: tile('hexframe'),
      actor: you,
    },
    {
      _tag: 'Navigation',
      id: 'n2',
      at: at(1, 21, 47),
      steps: [
        { gesture: 'collapse', tile: 'projects' },
        { gesture: 'show-context', tile: 'software-engineering' },
      ],
      gestures: 7,
    },
    {
      _tag: 'Change',
      id: 'c4',
      at: at(1, 21, 50),
      verb: 'TilesSwapped',
      tile: tile('principles'),
      other: tile('projects'),
      actor: you,
    },
    {
      _tag: 'Change',
      id: 'c5',
      at: at(1, 22, 5),
      verb: 'TileMoved',
      tile: tile('principles'),
      actor: { _tag: 'Key' },
    },
    {
      _tag: 'Navigation',
      id: 'n3',
      at: today(5),
      steps: [{ gesture: 'center', tile: 'ulysse' }],
      gestures: 1,
    },
    { _tag: 'Change', id: 'c6', at: today(4), verb: 'TileDeleted', tile: drafts, actor: you },
    said('m3', today(2), 'user', 'What would you add to Games?'),
    said(
      'm4',
      today(1),
      'agent',
      'Games has no Children yet. From what you wrote, I would start with three: the games you design, the ones you play, and what they teach about rules. Shall I propose them?',
    ),
  ]
  return { entries, titles }
}
