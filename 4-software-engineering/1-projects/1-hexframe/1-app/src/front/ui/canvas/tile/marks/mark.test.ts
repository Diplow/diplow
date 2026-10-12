import { describe, expect, it } from 'vitest'

import { m } from '#/paraglide/messages'

import { markNote, wayTo } from './mark'

// Who touches a tile, as the canvas tells it: where the chat's pointing shows, on the tile or on its
// way, and what lasts of a mark in words, for its card and a screen reader.

const path = [{ id: 'root' }, { id: 'engineering' }, { id: 'projects' }, { id: 'hexframe' }]

describe('the tile the chat points at', () => {
  it('shows on its own hex where it is drawn', () => {
    expect(wayTo('projects', path.slice(0, 3), (id) => id !== 'root')).toEqual({
      id: 'projects',
      way: false,
    })
  })

  it('shows on the nearest of its ancestors drawn, its way, where it is not', () => {
    const drawn = new Set(['root', 'engineering', 'projects'])
    expect(wayTo('hexframe', path, (id) => drawn.has(id))).toEqual({ id: 'projects', way: true })
  })

  it('takes the nearest ancestor drawn, not the root', () => {
    const drawn = new Set(['root', 'engineering'])
    expect(wayTo('hexframe', path, (id) => drawn.has(id))).toEqual({
      id: 'engineering',
      way: true,
    })
  })

  it('shows nowhere when nothing on its way is drawn', () => {
    expect(wayTo('hexframe', path, () => false)).toBeUndefined()
  })

  it('shows on a tile standing in a slot, which the System has no path to yet', () => {
    expect(wayTo('tooling', [], (id) => id === 'tooling')).toEqual({ id: 'tooling', way: false })
  })
})

describe('what lasts of a mark, in words', () => {
  it('says nothing of a light that passes: the chat said it already', () => {
    expect(markNote({ pointed: 'tile', glint: { by: 'agent', key: 1 } })).toBeUndefined()
    expect(markNote(undefined)).toBeUndefined()
  })

  it('says the agent works here, in its violet', () => {
    expect(markNote({ working: true })).toEqual({ text: m.tile_mark_working(), tone: 'agent' })
  })

  it('says who changed it while you looked away, a Key in no colour of its own', () => {
    expect(markNote({ unseen: 'agent' })).toEqual({
      text: m.tile_mark_unseen_agent(),
      tone: 'agent',
    })
    expect(markNote({ unseen: 'key' })).toEqual({ text: m.tile_mark_unseen_key() })
  })

  it('says what a Proposal would do', () => {
    expect(markNote({ proposed: 'move' })?.text).toBe(m.tile_mark_proposed_move())
    expect(markNote({ proposed: 'delete' })?.text).toBe(m.tile_mark_proposed_delete())
  })

  it("says the agent at work first, then what changed it, in the agent's violet", () => {
    expect(markNote({ working: true, unseen: 'key' })).toEqual({
      text: `${m.tile_mark_working()}, ${m.tile_mark_unseen_key()}`,
      tone: 'agent',
    })
  })
})
