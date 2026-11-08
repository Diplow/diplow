import { describe, expect, it } from 'vitest'

import { flightOf, pageZoomOf } from './zoom'

// The page's zoom on a page of 800 × 600 px: where it stands as it grows out of a hex, and whole;
// and a drawing's flight from one hex onto the one it rests on.

const size = { width: 800, height: 600 }

/** A number as CSS writes it, an exponent included. */
const number = String.raw`-?\d+(?:\.\d+)?(?:e-?\d+)?`

/** The px a CSS polygon names, as numbers, corner by corner. */
const cornersOf = (polygon: unknown) =>
  [...String(polygon).matchAll(new RegExp(`(${number})px (${number})px`, 'g'))].map(([, x, y]) => ({
    x: Number(x),
    y: Number(y),
  }))

/** A transform's move and scale, as numbers. */
const placingOf = (transform: unknown) => {
  const [x = NaN, y = NaN, scale = NaN] = [
    ...String(transform).matchAll(new RegExp(number, 'g')),
  ].map(([n]) => Number(n))
  return { x, y, scale }
}

describe('pageZoomOf', () => {
  const hex = { center: { x: 200, y: 150 }, radius: 60 }
  const [from, to] = pageZoomOf(hex, size)

  it('starts scaled down evenly onto the hex, cut to its shape, its corners on the hex', () => {
    const { x, y, scale } = placingOf(from.transform)
    // The largest hex the page holds is 600 px tall: a radius of 300 scaled to 60.
    expect(scale).toBeCloseTo(0.2)
    const corners = cornersOf(from.clipPath)
    expect(corners).toHaveLength(6)
    for (const corner of corners) {
      const drawn = { x: x + scale * corner.x, y: y + scale * corner.y }
      expect(Math.hypot(drawn.x - hex.center.x, drawn.y - hex.center.y)).toBeCloseTo(hex.radius)
    }
    expect(from.opacity).toBe(0)
  })

  it('stands whole at its own size, uncut', () => {
    expect(placingOf(to.transform)).toEqual({ x: 0, y: 0, scale: 1 })
    const corners = cornersOf(to.clipPath)
    expect(corners).toHaveLength(6)
    expect(corners).toEqual(
      expect.arrayContaining([
        { x: 0, y: 0 },
        { x: 800, y: 0 },
        { x: 800, y: 600 },
        { x: 0, y: 600 },
      ]),
    )
    expect(to.opacity).toBe(1)
  })

  it('cuts a page narrower than its hex by the hex its width holds', () => {
    const [narrow] = pageZoomOf(hex, { width: 390, height: 700 })
    const corners = cornersOf(narrow.clipPath)
    expect(corners).toHaveLength(6)
    // Its sides touch the page's: a hex of the width's radius.
    expect(Math.min(...corners.map(({ x }) => x))).toBeCloseTo(0)
    expect(Math.max(...corners.map(({ x }) => x))).toBeCloseTo(390)
  })
})

describe('flightOf', () => {
  // The drawing rests with its hex at (100, 80), radius 20; it flies from a hex three times as large.
  const at = { center: { x: 100, y: 80 }, radius: 20 }
  const from = { center: { x: 600, y: 300 }, radius: 60 }
  const [start, rest] = flightOf(from, at)

  it('starts with the hex it rests on standing on the one it flies from', () => {
    const { x, y, scale } = placingOf(start.transform)
    expect(scale).toBeCloseTo(3)
    expect(x + scale * at.center.x).toBeCloseTo(from.center.x)
    expect(y + scale * at.center.y).toBeCloseTo(from.center.y)
  })

  it('rests where it stands', () => {
    expect(placingOf(rest.transform)).toEqual({ x: 0, y: 0, scale: 1 })
  })
})
