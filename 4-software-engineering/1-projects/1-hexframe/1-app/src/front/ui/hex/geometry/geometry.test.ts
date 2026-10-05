import { describe, expect, it } from 'vitest'

import {
  directions,
  hexCorners,
  hexWidth,
  insetHex,
  neighbor,
  opposite,
  textBox,
  type Hex,
  type Point,
} from './geometry'

const origin: Hex = { center: { x: 0, y: 0 }, radius: 10 }

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Whether a point lies inside a pointy-top hex, with a hair of tolerance for rounding. */
function contains({ center, radius }: Hex, point: Point) {
  const x = Math.abs(point.x - center.x)
  const y = Math.abs(point.y - center.y)
  const apothem = (Math.sqrt(3) / 2) * radius
  return x <= apothem + 1e-9 && x / Math.sqrt(3) + y <= radius + 1e-9
}

describe('opposite', () => {
  it('pairs each direction with the one three away', () => {
    expect(directions.map(opposite)).toEqual([4, 5, 6, 1, 2, 3])
  })
})

describe('hexWidth', () => {
  it('measures a pointy hex: √3 radii across', () => {
    expect(hexWidth(10)).toBeCloseTo(17.32, 2)
  })
})

describe('hexCorners', () => {
  it('starts at the top corner, and every corner sits one radius from the center', () => {
    const corners = hexCorners(origin)
    expect(corners[0]?.x).toBeCloseTo(0)
    expect(corners[0]?.y).toBeCloseTo(-10)
    for (const corner of corners) expect(distance(corner, origin.center)).toBeCloseTo(10)
  })
})

describe('neighbor', () => {
  it('places each direction where its name says, on screen', () => {
    const at = (direction: 1 | 2 | 3 | 4 | 5 | 6) => neighbor(origin, direction).center
    expect(at(1).x).toBeLessThan(0)
    expect(at(1).y).toBeLessThan(0)
    expect(at(2).x).toBeGreaterThan(0)
    expect(at(2).y).toBeLessThan(0)
    expect(at(3).y).toBeCloseTo(0)
    expect(at(3).x).toBeGreaterThan(0)
    expect(at(4).x).toBeGreaterThan(0)
    expect(at(4).y).toBeGreaterThan(0)
    expect(at(5).x).toBeLessThan(0)
    expect(at(5).y).toBeGreaterThan(0)
    expect(at(6).y).toBeCloseTo(0)
    expect(at(6).x).toBeLessThan(0)
  })

  it('shares a side: two corners in common with the hex it neighbors', () => {
    for (const direction of directions) {
      const shared = hexCorners(neighbor(origin, direction)).filter((corner) =>
        hexCorners(origin).some((own) => distance(corner, own) < 1e-9),
      )
      expect(shared).toHaveLength(2)
    }
  })

  it('comes back with the opposite direction', () => {
    for (const direction of directions) {
      const back = neighbor(neighbor(origin, direction), opposite(direction))
      expect(back.center.x).toBeCloseTo(0)
      expect(back.center.y).toBeCloseTo(0)
    }
  })
})

describe('insetHex', () => {
  it('moves each side inwards by the distance', () => {
    const apothem = (hex: Hex) => (Math.sqrt(3) / 2) * hex.radius
    expect(apothem(origin) - apothem(insetHex(origin, 1))).toBeCloseTo(1)
  })
})

describe('textBox', () => {
  it.each(['tall', 'wide'] as const)('keeps every corner of %s text inside the hex', (shape) => {
    const box = textBox(origin, shape)
    const corners = [
      { x: box.x, y: box.y },
      { x: box.x + box.width, y: box.y },
      { x: box.x, y: box.y + box.height },
      { x: box.x + box.width, y: box.y + box.height },
    ]
    for (const corner of corners) expect(contains(origin, corner)).toBe(true)
  })
})
