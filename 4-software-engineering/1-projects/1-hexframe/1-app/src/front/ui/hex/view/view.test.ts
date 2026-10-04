import { describe, expect, it } from 'vitest'

import { layoutCanvas, type TileNode } from '../geometry/layout'

import {
  centerOn,
  findTile,
  pathTo,
  readCanvasView,
  showView,
  tileAction,
  toggleContext,
  toggleExpanded,
  type CanvasView,
} from './view'

const tile = (id: string, more: Partial<TileNode> = {}): TileNode => ({
  id,
  title: id,
  preview: '',
  ...more,
})

const system = tile('root', {
  children: {
    1: tile('a', { children: { 3: tile('a3', { children: { 2: tile('a3b') } }) } }),
    4: tile('b'),
  },
  context: { 2: tile('why', { children: { 1: tile('why1') } }) },
})

describe('readCanvasView', () => {
  it('reads each field it understands', () => {
    expect(readCanvasView({ center: 'a', expanded: ['a3'], context: true })).toEqual({
      center: 'a',
      expanded: ['a3'],
      context: true,
    })
  })

  it('leaves out a field it cannot read, and the defaults', () => {
    expect(readCanvasView({})).toEqual({})
    expect(readCanvasView({ center: 3, expanded: 'a', context: 'yes' })).toEqual({})
    expect(readCanvasView({ center: '', expanded: [], context: false })).toEqual({})
  })

  it('sets every field, so a raw value the router keeps underneath is overwritten', () => {
    const view = readCanvasView({ center: 3, expanded: 5, context: 'x' })
    // Strict, so each key must be there, set to `undefined`, not merely absent.
    expect(view).toStrictEqual({ center: undefined, expanded: undefined, context: undefined })
  })

  it('drops an expansion list holding anything but ids', () => {
    expect(readCanvasView({ expanded: ['a', 1], context: true })).toEqual({ context: true })
    expect(readCanvasView({ center: 'x'.repeat(101) })).toEqual({})
  })
})

describe('findTile', () => {
  it('finds a Tile anywhere below the root, in a Child or a Context slot', () => {
    expect(findTile(system, 'root')).toBe(system)
    expect(findTile(system, 'a3b')?.id).toBe('a3b')
    expect(findTile(system, 'why1')?.id).toBe('why1')
    expect(findTile(system, 'nowhere')).toBeUndefined()
  })
})

describe('pathTo', () => {
  const ids = (id: string) => pathTo(system, id).map((tile) => tile.id)

  it('goes from the root down to the Tile, both included', () => {
    expect(ids('root')).toEqual(['root'])
    expect(ids('a3b')).toEqual(['root', 'a', 'a3', 'a3b'])
  })

  it('goes through a Context slot', () => {
    expect(ids('why1')).toEqual(['root', 'why', 'why1'])
  })

  it('is empty for an id no Tile has', () => {
    expect(ids('nowhere')).toEqual([])
  })

  it('reaches the Tile itself, not a Reference to it met first', () => {
    const referenced = tile('root', {
      children: { 4: tile('b', { children: { 1: tile('b1') } }) },
      context: { 1: tile('b', { reference: true }) },
    })
    expect(pathTo(referenced, 'b').map((found) => found.id)).toEqual(['root', 'b'])
    expect(findTile(referenced, 'b')?.children?.[1]?.id).toBe('b1')
  })
})

describe('showView', () => {
  it('centers the root when no center is given, or an unknown one', () => {
    expect(showView(system, {}).center).toBe(system)
    expect(showView(system, { center: 'nowhere' }).center).toBe(system)
    expect(showView(system, { center: 'a' }).center.id).toBe('a')
  })

  it('keeps only the expansions a reader can see', () => {
    // a3 sits inside a, which is collapsed; b is not below the center at all once a is centered.
    expect([...showView(system, { expanded: ['a3', 'b'] }).expanded]).toEqual(['b'])
    expect([...showView(system, { expanded: ['a3', 'a'] }).expanded]).toEqual(['a', 'a3'])
    expect([...showView(system, { center: 'a', expanded: ['a3', 'b'] }).expanded]).toEqual(['a3'])
  })
})

describe('toggleExpanded', () => {
  it('expands a Child, then collapses it and what was open inside it', () => {
    const open = toggleExpanded(system, {}, 'a')
    expect(open).toEqual({ expanded: ['a'] })
    const nested = toggleExpanded(system, open, 'a3')
    expect(nested).toEqual({ expanded: ['a', 'a3'] })
    expect(toggleExpanded(system, nested, 'a')).toEqual({})
  })

  it('keeps the rest of the view', () => {
    expect(toggleExpanded(system, { center: 'a', context: true }, 'a3')).toEqual({
      center: 'a',
      expanded: ['a3'],
      context: true,
    })
  })
})

describe('toggleContext', () => {
  it('shows the Context, then hides it, leaving no default in the URL', () => {
    const shown = toggleContext(system, {})
    expect(shown).toEqual({ context: true })
    expect(toggleContext(system, shown)).toEqual({})
  })
})

describe('centerOn', () => {
  it('centers a Tile, keeps the expansions below it and closes the Context', () => {
    const view: CanvasView = { expanded: ['a', 'a3', 'b'], context: true }
    expect(centerOn(system, view, 'a')).toEqual({ center: 'a', expanded: ['a3'] })
  })

  it('leaves the center out of the URL for the root', () => {
    expect(centerOn(system, { center: 'a' }, 'root')).toEqual({})
  })

  it('centers a Context Tile too', () => {
    expect(centerOn(system, {}, 'why')).toEqual({ center: 'why' })
  })
})

describe('tileAction', () => {
  const canvas = { center: { x: 0, y: 0 }, radius: 300 }

  function actions(view: Parameters<typeof showView>[1]) {
    const shown = showView(system, view)
    return Object.fromEntries(
      layoutCanvas(shown.center, shown, canvas).flatMap((placement) =>
        placement.kind === 'tile' ? [[placement.key, tileAction(placement, shown)]] : [],
      ),
    )
  }

  it('shows the Context from the center, expands a Child, collapses an expanded one', () => {
    expect(actions({ expanded: ['a'] })).toEqual({
      'tile:root': 'show-context',
      'tile:a': 'collapse',
      'tile:a3': 'expand',
      'tile:b': 'expand',
    })
  })

  it('hides the Context from the center drawn inside it, and centers a Context Tile', () => {
    expect(actions({ context: true })).toEqual({
      'tile:root': 'hide-context',
      'tile:context:2': 'center',
      'tile:a': 'expand',
      'tile:b': 'expand',
    })
  })
})
