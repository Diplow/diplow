// @vitest-environment happy-dom
import { act as settled, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { layoutCanvas, type CanvasHex } from '../geometry/shape'
import { pathTo, type TileNode } from '../view/tiles'
import { centerOn, showView, type CanvasView } from '../view/view'

import {
  courseOf,
  flightFor,
  heartShare,
  keyframesOf,
  placingAt,
  reframingOf,
  stillOf,
  useCamera,
  type Drawing,
} from './useCamera'

// The camera over a System made by hand: how the last drawing lies in the next as the center
// changes, where both stand along the way, what of the last stays drawn beneath, and how long it
// lasts, from the tokens, none with reduced motion.

afterEach(cleanup)

const tile = (id: string, more: Partial<TileNode> = {}): TileNode => ({
  id,
  title: id,
  preview: '',
  ...more,
})

const system = tile('root', {
  branches: {
    1: tile('a', { branches: { 3: tile('a3', { branches: { 2: tile('a3b') } }) } }),
    4: tile('b', { branches: { 1: tile('b1') } }),
  },
  leaves: { 2: tile('notes', { leaf: true }) },
})

/** The canvas's drawing of a view. */
function drawn(view: CanvasView): Drawing {
  const shown = showView(system, view)
  return {
    center: shown.center.id,
    path: pathTo(system, shown.center.id).map(({ id }) => id),
    hexes: layoutCanvas(shown),
  }
}

/** The hex drawn under this key. */
function hexIn(drawing: Drawing, key: string): CanvasHex {
  const found = drawing.hexes.find((hex) => hex.key === key)
  if (found === undefined) throw new Error(`Nothing is drawn under ${key}`)
  return found
}

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9

describe('heartShare', () => {
  it('is how much smaller a Branch opened in place draws itself at its heart', () => {
    const closed = hexIn(drawn(centerOn(system, 'root')), 'tile:a')
    const opened = hexIn(drawn({ frame: 'children', expanded: { 1: 'children' } }), 'tile:a')
    expect(near(opened.hex.radius / closed.hex.radius, heartShare)).toBe(true)
  })
})

describe('courseOf', () => {
  const root = drawn(centerOn(system, 'root'))
  const inA = drawn(centerOn(system, 'a'))

  it('flies into a child from where it was drawn, at the heart it would open around', () => {
    const course = courseOf(root, inA)
    const a = hexIn(root, 'tile:a').hex
    expect(course).toMatchObject({ levels: 1, arrived: true })
    expect(course.from).toEqual({ center: a.center, radius: a.radius * heartShare })
    expect(course.to).toEqual(hexIn(inA, 'tile:a').hex)
  })

  it('flies into a Branch opened in place from its heart as drawn', () => {
    const opened = drawn({ frame: 'children', expanded: { 1: 'children' } })
    expect(courseOf(opened, inA).from).toEqual(hexIn(opened, 'tile:a').hex)
  })

  it('flies into a Leaf, which stands alone, from its hex as drawn, both closed', () => {
    const course = courseOf(root, drawn(centerOn(system, 'notes')))
    const notes = hexIn(root, 'tile:notes').hex
    expect(course.from.radius / course.to.radius).toBeLessThan(1)
    expect(near(course.from.radius, notes.radius * heartShare)).toBe(true)
  })

  it('flies out to a parent, the last center coming to where the parent draws it', () => {
    const course = courseOf(inA, root)
    const a = hexIn(root, 'tile:a').hex
    expect(course).toMatchObject({ levels: 1, arrived: false })
    expect(course.from).toEqual(hexIn(inA, 'tile:a').hex)
    expect(course.to).toEqual({ center: a.center, radius: a.radius * heartShare })
  })

  it('flies past what is not drawn, through the nearest Tile above it that is', () => {
    const deep = drawn(centerOn(system, 'a3b'))
    const into = courseOf(root, deep)
    const a = hexIn(root, 'tile:a').hex
    expect(into.levels).toBe(3)
    expect(into.from.center).toEqual(a.center)
    expect(near(into.from.radius, a.radius * heartShare ** 3)).toBe(true)
    const out = courseOf(deep, root)
    expect(out.to.center).toEqual(a.center)
    expect(near(out.to.radius, a.radius * heartShare ** 3)).toBe(true)
  })

  it('crosses from one Tile to another at the same place, by the levels between them', () => {
    const inB = drawn(centerOn(system, 'b'))
    const across = courseOf(inA, inB)
    expect(across).toMatchObject({ levels: 0, arrived: false })
    expect(across.from).toEqual(across.to)
    const below = courseOf(inB, drawn(centerOn(system, 'a3')))
    expect(below.levels).toBe(1)
    expect(near(below.to.radius * heartShare, below.from.radius)).toBe(true)
  })
})

describe('placingAt', () => {
  const course = courseOf(drawn(centerOn(system, 'root')), drawn(centerOn(system, 'a')))
  const at = (
    placing: { scale: number; x: number; y: number },
    { x, y }: { x: number; y: number },
  ) => ({
    x: placing.scale * x + placing.x,
    y: placing.scale * y + placing.y,
  })

  it('starts the next drawing where its center was, and the last one where it is', () => {
    const { next, last } = placingAt(course, 0)
    const start = at(next, course.to.center)
    expect(near(start.x, course.from.center.x) && near(start.y, course.from.center.y)).toBe(true)
    expect(near(next.scale * course.to.radius, course.from.radius)).toBe(true)
    expect(near(last.scale, 1) && near(last.x, 0) && near(last.y, 0)).toBe(true)
  })

  it('brings the next drawing to rest, the last one carried with it', () => {
    const { next, last } = placingAt(course, 1)
    expect(near(next.scale, 1) && near(next.x, 0) && near(next.y, 0)).toBe(true)
    const end = at(last, course.from.center)
    expect(near(end.x, course.to.center.x) && near(end.y, course.to.center.y)).toBe(true)
  })

  it('moves the place both share along a straight line, at an even pace', () => {
    const half = at(placingAt(course, 0.5).next, course.to.center)
    expect(near(half.x, (course.from.center.x + course.to.center.x) / 2)).toBe(true)
    expect(near(half.y, (course.from.center.y + course.to.center.y) / 2)).toBe(true)
  })
})

describe('keyframesOf', () => {
  const into = courseOf(drawn(centerOn(system, 'root')), drawn(centerOn(system, 'a')))
  const out = courseOf(drawn(centerOn(system, 'a')), drawn(centerOn(system, 'root')))

  it('ends at rest, a transform of none', () => {
    expect(keyframesOf(into, 'next').at(-1)).toMatchObject({
      offset: 1,
      transform: 'matrix(1, 0, 0, 1, 0, 0)',
    })
  })

  it('fades the last drawing out, and the next one in where it was not drawn before', () => {
    expect(keyframesOf(into, 'last').map(({ opacity }) => opacity)).toContain(0)
    expect(keyframesOf(into, 'next').every(({ opacity }) => opacity === 1)).toBe(true)
    expect(keyframesOf(out, 'next')[0]).toMatchObject({ opacity: 0 })
  })
})

describe('stillOf', () => {
  const root = drawn(centerOn(system, 'root'))
  const inA = drawn(centerOn(system, 'a'))

  it('keeps what the next drawing does not draw, the center arriving opened as its ground', () => {
    const still = stillOf(root, inA, courseOf(root, inA))
    const keys = still.map(({ key }) => key)
    expect(keys).toContain('tile:root')
    expect(keys).toContain('tile:b')
    expect(keys).not.toContain('tile:a')
    expect(still.find(({ key }) => key === 'ground:tile:a')).toMatchObject({
      kind: 'ground',
      hex: hexIn(root, 'tile:a').hex,
    })
  })

  it('keeps all of the last drawing where the next one fades in over it', () => {
    expect(stillOf(inA, root, courseOf(inA, root))).toEqual(inA.hexes)
  })
})

describe('reframingOf', () => {
  it("carries the center's hex from alone, large, to the heart of its ring, and back", () => {
    const alone = drawn({})
    const opened = drawn({ frame: 'children' })
    const course = reframingOf(alone.hexes, opened.hexes, 'root')
    expect(course).toMatchObject({ from: hexIn(alone, 'tile:root').hex, levels: 0, arrived: true })
    expect(course?.to).toEqual(hexIn(opened, 'tile:root').hex)
    expect(course && course.from.radius > course.to.radius).toBe(true)
    expect(reframingOf(opened.hexes, alone.hexes, 'root')?.to).toEqual(course?.from)
  })

  it('leaves the drawing where it is while the center stands as it stood', () => {
    const opened = drawn({ frame: 'children' })
    const branch = drawn({ frame: 'children', expanded: { 4: 'children' } })
    expect(reframingOf(opened.hexes, branch.hexes, 'root')).toBeUndefined()
  })
})

describe('flightFor and the camera', () => {
  const style = document.documentElement.style

  /** The page asks for reduced motion, or not. */
  function reduced(still: boolean) {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: still && query.includes('reduce') }))
  }

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    style.removeProperty('--duration-camera')
    style.removeProperty('--duration-camera-level')
  })

  function tokens() {
    style.setProperty('--duration-camera', '800ms')
    style.setProperty('--duration-camera-level', '300ms')
  }

  it('lasts --duration-camera, and --duration-camera-level more per level, up to two', () => {
    tokens()
    reduced(false)
    expect([0, 1, 2, 3].map(flightFor)).toEqual([800, 1100, 1400, 1400])
    reduced(true)
    expect(flightFor(1)).toBe(0)
  })

  /** The camera over the drawing of `view`, which the test changes. */
  function camera(view: CanvasView) {
    return renderHook(
      ({ view: shown }: { view: CanvasView }) => {
        const { center, hexes } = drawn(shown)
        return useCamera({ system, center, hexes })
      },
      { initialProps: { view } },
    )
  }

  it('draws the last view still while it flies to the next, then lets it go', () => {
    vi.useFakeTimers()
    tokens()
    reduced(false)
    const { result, rerender } = camera(centerOn(system, 'root'))
    expect(result.current.still).toBeUndefined()
    rerender({ view: { frame: 'children', expanded: { 4: 'children' } } })
    expect(result.current.still).toBeUndefined()
    rerender({ view: centerOn(system, 'a') })
    expect(result.current.still?.map(({ key }) => key)).toContain('tile:root')
    settled(() => {
      vi.advanceTimersByTime(1100)
    })
    expect(result.current.still).toBeUndefined()
  })

  it('flies as the center opens from alone and folds back, with nothing beneath', () => {
    vi.useFakeTimers()
    tokens()
    reduced(false)
    const { result, rerender } = camera({})
    rerender({ view: { frame: 'children' } })
    expect(result.current.still).toEqual([])
    settled(() => {
      vi.advanceTimersByTime(800)
    })
    expect(result.current.still).toBeUndefined()
    rerender({ view: {} })
    expect(result.current.still).toEqual([])
  })

  it('lands at once with reduced motion', () => {
    tokens()
    reduced(true)
    const { result, rerender } = camera(centerOn(system, 'root'))
    rerender({ view: centerOn(system, 'a') })
    expect(result.current.still).toBeUndefined()
  })
})
