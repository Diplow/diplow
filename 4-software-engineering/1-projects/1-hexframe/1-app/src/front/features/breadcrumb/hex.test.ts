import { describe, expect, it } from 'vitest'

import type { TileHex } from '#/front/ui/canvas/state/useCanvasState'
import type { TileNode } from '#/front/ui/canvas/view/tiles'

import { hexLetsOf, hexViewOf, pageGoneTo } from './hex'

// The hex widget, while the center shows as its page: what it draws, what its Tiles let through, and
// where a gesture on one goes.

const tile = (id: string, more: Partial<TileNode> = {}): TileNode => ({
  id,
  title: id,
  preview: '',
  ...more,
})

const system = tile('root', {
  branches: {
    1: tile('a', { branches: { 2: tile('a2') }, context: { 3: tile('a-c') } }),
    4: tile('b', { branches: { 1: tile('b1') } }),
  },
  leaves: { 2: tile('note', { leaf: true }) },
  context: { 5: tile('pin', { reference: { from: 'Elsewhere' } }) },
})

const drawn = (id: string) => ({ tile: { id } }) as TileHex

describe("the hex widget's view", () => {
  it('draws the center at its fullest beneath its page, its ring and its Context', () => {
    expect(hexViewOf(system, { center: 'a', page: true })).toEqual({
      center: 'a',
      frame: 'children',
      inner: 'context',
    })
  })

  it('keeps the Tiles around the center as the link opens them', () => {
    expect(hexViewOf(system, { center: 'a', page: true, around: { 4: {} } })).toEqual({
      center: 'a',
      frame: 'children',
      inner: 'context',
      around: { 4: {} },
    })
  })

  it('draws a Leaf alone, which opens nothing', () => {
    expect(hexViewOf(system, { center: 'note', page: true })).toEqual({ center: 'note' })
  })
})

describe("what the hex widget's Tiles let through", () => {
  const view = { center: 'a', page: true as const }

  it('holds the center back, whose page is open', () => {
    expect(hexLetsOf(system, view)(drawn('a'))).toEqual({ click: false, recenter: false })
  })

  it('holds back a Tile of another System, a pin, which only the canvas follows', () => {
    expect(hexLetsOf(system, view)(drawn('elsewhere'))).toEqual({ click: false, recenter: false })
  })

  it('lets every gesture through on the others', () => {
    expect(hexLetsOf(system, view)(drawn('a2'))).toEqual({ click: true, recenter: true })
  })

  it("lets through what the canvas's own rules let through, the tutorial's", () => {
    const rules = () => ({ click: true, recenter: false })
    expect(hexLetsOf(system, view, rules)(drawn('a2'))).toEqual({ click: true, recenter: false })
    expect(hexLetsOf(system, view, rules)(drawn('a'))).toEqual({ click: false, recenter: false })
  })
})

describe('where a gesture in the hex widget goes', () => {
  const view = { center: 'a', page: true as const }

  it('opens the page of the Tile centered, a center gesture, as it was centered', () => {
    const next = { center: 'b', frame: 'children' as const }
    expect(pageGoneTo(system, view, next, { gesture: 'center', tile: 'b' })).toEqual({
      view: { center: 'b', page: true },
      action: { gesture: 'center', tile: 'b' },
    })
  })

  it('opens the page of a Branch opened in place, as a finger opens it', () => {
    const next = { center: 'a', frame: 'children' as const, expanded: { 1: 'children' as const } }
    expect(pageGoneTo(system, view, next, { gesture: 'expand', tile: 'a2' })).toEqual({
      view: { center: 'a2', page: true },
      action: { gesture: 'center', tile: 'a2' },
    })
  })

  it('goes nowhere on the center, whose page is open', () => {
    expect(pageGoneTo(system, view, { center: 'a' }, { gesture: 'collapse', tile: 'a' })).toBe(
      undefined,
    )
  })
})
