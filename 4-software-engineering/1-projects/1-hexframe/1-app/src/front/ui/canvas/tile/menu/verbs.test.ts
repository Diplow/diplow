import { describe, expect, it } from 'vitest'

import { actsAtOnce, clickOf, groupsOf, placeOf, type Subject } from './verbs'

const branch: Subject = {
  kind: 'branch',
  title: 'Projects',
  at: 2,
  parent: 'Software engineering',
  below: 3,
}

describe('what a tile offers', () => {
  it('groups a Branch of the ring by distance: going there, changing it, placing it, the agent, sharing, then deleting', () => {
    expect(groupsOf(branch)).toEqual([
      ['open', 'go-in', 'show-context'],
      ['edit'],
      ['add', 'move'],
      ['ask-agent'],
      ['copy', 'export'],
      ['delete'],
    ])
  })

  it('turns a tile into the other kind only where its caller says Mapping allows it', () => {
    expect(groupsOf({ ...branch, turns: true })[1]).toEqual(['edit', 'make-leaf'])
    expect(groupsOf({ ...branch, kind: 'leaf', turns: true })[1]).toEqual(['edit', 'make-branch'])
    expect(groupsOf({ ...branch, kind: 'leaf' })[1]).toEqual(['edit'])
  })

  it('adds nothing to a Leaf, which holds no tile', () => {
    expect(groupsOf({ ...branch, kind: 'leaf' }).flat()).not.toContain('add')
  })

  it('removes a Reference rather than deleting the tile it points at, and never edits it', () => {
    const reference = groupsOf({ ...branch, kind: 'reference' }).flat()
    expect(reference).toContain('remove-reference')
    expect(reference).not.toContain('delete')
    expect(reference).not.toContain('edit')
    expect(groupsOf({ ...branch, kind: 'broken' })).toEqual([['ask-agent'], ['remove-reference']])
  })

  it('leaves the agent its draft: open it, or ask about it', () => {
    expect(groupsOf({ ...branch, kind: 'draft' })).toEqual([['open'], ['ask-agent']])
  })

  it('never moves nor deletes the center, which backs out to the tile it is in', () => {
    const center = groupsOf({ ...branch, at: 'center' }).flat()
    expect(center[0]).toBe('back-out')
    expect(center).not.toContain('move')
    expect(center).not.toContain('delete')
    expect(center).not.toContain('open')
  })

  it('offers the root no way out, and an untitled one a vault to import', () => {
    const root = groupsOf({ kind: 'root', title: 'diplow', at: 'center' }).flat()
    expect(root).not.toContain('back-out')
    expect(groupsOf({ kind: 'untitled', title: 'Untitled', at: 'center' }).flat()).toContain(
      'import',
    )
  })

  it('offers a free slot a new tile, an import, or the agent', () => {
    expect(groupsOf({ kind: 'slot', at: 4, parent: 'Projects' })).toEqual([
      ['new-tile', 'import'],
      ['ask-agent'],
    ])
  })

  it('opens a submenu for a place or a copy, and acts at once for the rest', () => {
    expect([actsAtOnce('add'), actsAtOnce('move'), actsAtOnce('copy')]).toEqual([
      false,
      false,
      false,
    ])
    expect(actsAtOnce('delete')).toBe(true)
  })
})

describe('a click and a tap', () => {
  it('opens a Branch of the ring in place under the pointer, and goes in under a finger', () => {
    expect(clickOf(branch, false)).toBe('open')
    expect(clickOf(branch, true)).toBe('go-in')
  })

  it('goes into a Leaf either way, its only way to open', () => {
    expect(clickOf({ ...branch, kind: 'leaf' }, false)).toBe('open')
    expect(clickOf({ ...branch, kind: 'leaf' }, true)).toBe('open')
  })

  it('shows the center its Context, but a Leaf at the center takes none', () => {
    expect(clickOf({ ...branch, at: 'center' }, true)).toBe('show-context')
    expect(clickOf({ ...branch, kind: 'leaf', at: 'center' }, false)).toBeUndefined()
  })

  it('does nothing on a Reference whose tile is gone, and adds a tile on a free slot', () => {
    expect(clickOf({ ...branch, kind: 'broken' }, false)).toBeUndefined()
    expect(clickOf({ kind: 'slot', at: 1, parent: 'Projects' }, true)).toBe('new-tile')
  })
})

describe('the place a menu and a card name', () => {
  it('says its kind, its Direction and the tile it is in', () => {
    expect(placeOf(branch)).toBe('branch, north-east in Software engineering')
    expect(placeOf({ kind: 'root', title: 'diplow', at: 'center' })).toBe('root, the center')
    expect(placeOf({ ...branch, at: 'center' })).toBe('branch, the center, in Software engineering')
    expect(placeOf({ kind: 'slot', at: 6, parent: 'Projects' })).toBe('free, west in Projects')
  })
})
