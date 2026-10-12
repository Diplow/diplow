import { describe, expect, it } from 'vitest'

import type { Actor, Entry } from '#/domains/assistant/entities'
import type { PlacedTile, Slot, System } from '#/domains/mapping/entities'
import { m } from '#/paraglide/messages'
import { placeOf } from '#/front/ui/canvas/tile/menu/verbs'
import type { TileNode } from '#/front/ui/canvas/view/tiles'

import { acceptedOf, canvasMarksOf, cardOf, touchesOf } from './marks'
import type { Proposed } from './proposal'

// Who touches a Tile on home's canvas, from what the page holds: the chat pointing and centering, the
// Turn's location, the changes since the page opened, a Key's hollow, the user's acceptance their
// own, a change seen once its Tile is opened, and the open Proposal's ghosts, rims and arcs; and what
// a Tile named in the chat says in its card.

const at = new Date('2026-10-12T10:00:00Z')

const change = (id: string, tile: string, actor: Actor, other?: string): Entry => ({
  _tag: 'Change',
  id,
  at,
  verb: other === undefined ? 'TileEdited' : 'TilesSwapped',
  tile: { id: tile, title: tile },
  ...(other !== undefined && { other: { id: other, title: other } }),
  actor,
})

const agent: Actor = { _tag: 'Assistant' }
const key: Actor = { _tag: 'Key', name: 'laptop' }
const you: Actor = { _tag: 'You' }

const proposal = (
  id: string,
  fate: 'open' | 'accepted',
  tiles: string[],
  undone = false,
): Entry => ({
  _tag: 'Proposal',
  id: `entry-${id}`,
  at,
  proposal: id,
  changes: tiles.map((tile) => ({
    _tag: 'Change',
    verb: 'TileEdited',
    tile: { id: tile, title: tile },
  })),
  fate,
  ...(undone && { undone }),
})

describe('touchesOf, the changes made since the page opened', () => {
  const known = new Set(['old'])

  it('touches each Tile a change by the agent or a Key names, but those the page held first', () => {
    const entries = [
      change('old', 'a', agent),
      change('new', 'b', agent),
      change('keyed', 'c', key),
      change('mine', 'd', you),
      change('swap', 'e', agent, 'f'),
    ]
    expect(touchesOf(entries, { known, accepted: [] })).toEqual([
      { tile: 'b', by: 'agent', key: 'new' },
      { tile: 'c', by: 'key', key: 'keyed' },
      { tile: 'e', by: 'agent', key: 'swap' },
      { tile: 'f', by: 'agent', key: 'swap' },
    ])
  })

  it("makes the change the user's acceptance made theirs, once, a later one by the agent its own", () => {
    const entries = [
      change('before', 'b', agent),
      proposal('seen', 'accepted', ['b']),
      change('landed', 'b', agent),
      change('later', 'b', agent),
    ]
    const accepted = acceptedOf(entries, new Set(['seen']))
    expect(touchesOf(entries, { known: new Set(['before']), accepted })).toEqual([
      { tile: 'b', by: 'human', key: 'landed' },
      { tile: 'b', by: 'agent', key: 'later' },
    ])
  })
})

describe('acceptedOf, the changes an acceptance the page saw made', () => {
  it('reads the Proposals accepted, not undone, that the page saw open, each change by its place', () => {
    const entries = [
      proposal('seen', 'accepted', ['a', 'b']),
      proposal('before', 'accepted', ['c']),
      proposal('undone', 'accepted', ['d'], true),
      proposal('waiting', 'open', ['e']),
    ]
    const watched = new Set(['seen', 'undone', 'waiting'])
    expect(acceptedOf(entries, watched)).toEqual([
      { after: 0, change: 'TileEdited:a' },
      { after: 0, change: 'TileEdited:b' },
    ])
  })
})

describe('canvasMarksOf, who touches what the canvas draws', () => {
  it('runs the agent’s light round the Tile the Turn works in, and glints a Tile the chat centered', () => {
    const marks = canvasMarksOf({ working: 'a', arrived: { id: 'b', key: '1' }, pointed: 'c' })
    expect(marks.tile?.('a')).toEqual({ working: true })
    expect(marks.tile?.('b')).toEqual({ glint: { by: 'human', key: '1' } })
    expect(marks.tile?.('c')).toBeUndefined()
    expect(marks.pointed).toBe('c')
  })

  it('glints the last change to a Tile, and keeps its dot until a change of it is opened', () => {
    const touches = [
      { tile: 'a', by: 'agent' as const, key: 'one' },
      { tile: 'a', by: 'key' as const, key: 'two' },
      { tile: 'b', by: 'human' as const, key: 'three' },
    ]
    const marks = canvasMarksOf({ touches })
    expect(marks.tile?.('a')).toEqual({ glint: { by: 'key', key: 'two' }, unseen: 'key' })
    // The user's own acceptance glints in their amber, and leaves no dot.
    expect(marks.tile?.('b')).toEqual({ glint: { by: 'human', key: 'three' } })
    const seen = canvasMarksOf({ touches, opened: new Set(['two']) })
    expect(seen.tile?.('a')).toEqual({ glint: { by: 'key', key: 'two' }, unseen: 'agent' })
    const all = canvasMarksOf({ touches, opened: new Set(['one', 'two']) })
    expect(all.tile?.('a')).toEqual({ glint: { by: 'key', key: 'two' } })
  })

  it("stands the open Proposal's creates as ghosts, its changes on rims, its moves as arcs", () => {
    const proposed: Proposed = {
      ghosts: new Map([['made', { parent: 'p', slot: -3, title: 'Tooling', preview: 'Tools' }]]),
      changes: new Map([
        ['a', 'edit'],
        ['b', 'move'],
      ]),
      moves: new Map([['b', { parent: 'p', slot: { leaf: 5 } }]]),
    }
    const marks = canvasMarksOf({ proposed })
    expect(marks.tile?.('a')).toEqual({ proposed: 'edit' })
    expect(marks.arcs).toEqual([{ from: 'b', to: { parent: 'p', direction: 5 } }])
    const parent: TileNode = { id: 'p', title: 'P', preview: '' }
    expect(marks.slot?.({ parent, ring: 'context', direction: 3 })).toEqual({
      id: 'made',
      look: { kind: 'ghost', words: { title: 'Tooling', preview: 'Tools' } },
    })
    // A Branch's slot of the same Direction is another slot.
    expect(marks.slot?.({ parent, ring: 'children', direction: 3 })).toBeUndefined()
  })
})

describe('cardOf, what a Tile named in the chat says in its card', () => {
  const placed = (id: string, parent: string, slot: Slot, title = id): PlacedTile => ({
    _tag: 'Tile',
    id,
    title,
    preview: id === 'work' ? 'Where I work' : '',
    body: '',
    version: 1,
    parent,
    slot,
  })
  const system: System = {
    root: { _tag: 'Tile', id: 'root', title: '', preview: '', body: '', version: 1 },
    tiles: {
      work: placed('work', 'root', 2, 'Work'),
      notes: placed('notes', 'work', { leaf: 4 }, 'Notes'),
      why: placed('why', 'work', -1, 'Why'),
    },
    owned: true,
    version: 1,
  }
  const proposed: Proposed = {
    ghosts: new Map([['made', { parent: 'work', slot: 6, title: 'Tooling', preview: 'Tools' }]]),
    changes: new Map(),
    moves: new Map(),
  }

  it('says where a Tile stands and its Preview, as the canvas’s card does', () => {
    expect(cardOf(system, undefined, 'work')).toEqual({
      place: placeOf({ kind: 'branch', title: 'Work', at: 2, parent: m.system_untitled() }),
      description: 'Where I work',
    })
    expect(cardOf(system, undefined, 'notes')).toEqual({
      place: placeOf({ kind: 'leaf', title: 'Notes', at: 4, parent: 'Work' }),
    })
    expect(cardOf(system, undefined, 'why')).toEqual({
      place: placeOf({ kind: 'context', title: 'Why', at: 1, parent: 'Work' }),
    })
    expect(cardOf(system, undefined, 'root')).toEqual({
      place: placeOf({ kind: 'untitled', title: '', at: 'center' }),
    })
  })

  it('says where a Tile the Proposal would create would stand, and none for a Tile no one holds', () => {
    expect(cardOf(system, proposed, 'made')).toEqual({
      place: placeOf({ kind: 'branch', title: 'Tooling', at: 6, parent: 'Work' }),
      description: 'Tools',
    })
    expect(cardOf(system, proposed, 'gone')).toBeUndefined()
  })
})
