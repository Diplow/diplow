import { describe, expect, it } from 'vitest'

import type { TileNode } from '#/front/ui/hex/geometry/layout'

import { tileLink } from '#/api/mapping/download'

import { changeOf, readSystemSearch, viewOf, withChange, withoutTile, withView } from './search'

describe('readSystemSearch', () => {
  it('centers on the Tile an export links a left-out Reference to', () => {
    const id = crypto.randomUUID()
    const link = new URL(tileLink('https://hexframe.test/_serverFn/x')(id))
    expect(link.pathname).toBe('/')
    expect(viewOf(readSystemSearch(Object.fromEntries(link.searchParams))).center).toBe(id)
  })

  it('reads the view and the change, every field set', () => {
    expect(readSystemSearch({ center: 'a', context: true, add: 'a', slot: -2 })).toEqual({
      center: 'a',
      expanded: undefined,
      context: true,
      add: 'a',
      slot: -2,
      edit: undefined,
      move: undefined,
    })
  })

  it('falls back field by field on what the URL got wrong', () => {
    const search = readSystemSearch({ center: 'a', slot: 7, edit: '', move: 42 })
    expect(search).toMatchObject({ center: 'a', slot: undefined, edit: undefined })
    expect(search.move).toBeUndefined()
  })
})

describe('changeOf', () => {
  const read = (search: Record<string, unknown>) => changeOf(readSystemSearch(search))

  it('reads each change', () => {
    expect(read({})).toEqual({ kind: 'none' })
    expect(read({ add: 'a', slot: 3 })).toEqual({ kind: 'add', parent: 'a', slot: 3 })
    expect(read({ edit: 'a' })).toEqual({ kind: 'edit', id: 'a' })
    expect(read({ move: 'a' })).toEqual({ kind: 'move', id: 'a' })
  })

  it('opens no new Tile form without its slot', () => {
    expect(read({ add: 'a' })).toEqual({ kind: 'none' })
  })

  it('lets a form win over a move, since the form covers the canvas', () => {
    expect(read({ move: 'a', edit: 'b' })).toEqual({ kind: 'edit', id: 'b' })
    expect(read({ move: 'a', add: 'b', slot: 1 })).toMatchObject({ kind: 'add' })
  })
})

describe('withView and withChange', () => {
  const search = readSystemSearch({ center: 'a', expanded: ['b'], move: 'c' })

  it('changes the view and keeps the change under way', () => {
    const next = withView(search, { context: true })
    expect(viewOf(next)).toEqual({ center: undefined, expanded: undefined, context: true })
    expect(changeOf(next)).toEqual({ kind: 'move', id: 'c' })
  })

  it('changes the change and keeps the view', () => {
    const next = withChange(search, { kind: 'add', parent: 'a', slot: -4 })
    expect(viewOf(next)).toEqual(viewOf(search))
    expect(changeOf(next)).toEqual({ kind: 'add', parent: 'a', slot: -4 })
    expect(next.move).toBeUndefined()
  })

  it('ends the change under way', () => {
    expect(changeOf(withChange(search, { kind: 'none' }))).toEqual({ kind: 'none' })
  })
})

describe('withoutTile', () => {
  // a goes, and with it its Child a1 and its Context Tile a2; its Reference to b leaves b standing.
  const gone: TileNode = {
    id: 'a',
    title: 'A',
    preview: '',
    children: { 1: { id: 'a1', title: 'A1', preview: '' } },
    context: {
      2: { id: 'a2', title: 'A2', preview: '' },
      3: { id: 'b', title: 'B', preview: '', reference: true },
    },
  }

  it('ends the change under way when it named the Tile gone', () => {
    for (const search of [{ move: 'a' }, { edit: 'a' }, { add: 'a', slot: 2 }]) {
      const next = withoutTile(readSystemSearch({ center: 'c', ...search }), gone)
      expect(changeOf(next)).toEqual({ kind: 'none' })
      expect(next.center).toBe('c')
    }
  })

  it('ends the change under way when it named a Tile below it, a Child or a Context Tile', () => {
    for (const search of [{ move: 'a1' }, { edit: 'a2' }, { add: 'a1', slot: -2 }]) {
      expect(changeOf(withoutTile(readSystemSearch(search), gone))).toEqual({ kind: 'none' })
    }
  })

  it('keeps a change that named another Tile, one referenced from below included', () => {
    expect(changeOf(withoutTile(readSystemSearch({ move: 'c' }), gone))).toEqual({
      kind: 'move',
      id: 'c',
    })
    expect(changeOf(withoutTile(readSystemSearch({ move: 'b' }), gone))).toEqual({
      kind: 'move',
      id: 'b',
    })
  })
})
