import { describe, expect, it } from 'vitest'

import type { Direction, Point } from '../../geometry/geometry'
import { dropAt, landed, partOf, takes, type Frame } from './move'

const seats = {
  1: { swaps: true },
  2: { swaps: true },
  3: { swaps: false },
}
const frame: Frame = { seats }

describe('a tile on the move', () => {
  it('lifts, while each free slot offers itself, each Branch its swap, and the rest steps back', () => {
    expect(([1, 2, 3, 4] as const).map((direction) => partOf(frame, 1, direction))).toEqual([
      'lifted',
      'swap',
      'aside',
      'landing',
    ])
  })

  it('lands in a free slot or on a tile that trades, never on a Leaf nor on itself', () => {
    expect(takes(frame, 1, 4)).toBe(true)
    expect(takes(frame, 1, 2)).toBe(true)
    expect(takes(frame, 1, 3)).toBe(false)
    expect(takes(frame, 1, 1)).toBe(false)
  })

  it('finds a free slot shut where its caller says Mapping would refuse the tile', () => {
    const fussy: Frame = { seats, lands: (direction) => direction !== 4 }
    expect(partOf(fussy, 1, 4)).toBe('shut')
    expect(partOf(fussy, 1, 5)).toBe('landing')
    expect(takes(fussy, 1, 4)).toBe(false)
  })

  it('leaves its Direction free once moved, and takes the other one’s once swapped', () => {
    expect(landed(seats, 3, 5)).toEqual({ 1: seats[1], 2: seats[2], 5: seats[3] })
    expect(landed(seats, 1, 2)).toEqual({ 1: seats[2], 2: seats[1], 3: seats[3] })
  })

  it('changes nothing landing where it stands, or from a free slot', () => {
    expect(landed(seats, 1, 1)).toBe(seats)
    expect(landed(seats, 6, 1)).toBe(seats)
  })
})

describe('a drag let go', () => {
  const hearts: Record<Direction, Point> = {
    1: { x: -50, y: -87 },
    2: { x: 50, y: -87 },
    3: { x: 100, y: 0 },
    4: { x: 50, y: 87 },
    5: { x: -50, y: 87 },
    6: { x: -100, y: 0 },
  }
  const drop = (point: Point) => dropAt(point, hearts, { frame, from: 1, reach: 40 })

  it('lands on the nearest place within reach that takes it', () => {
    expect(drop({ x: 55, y: 80 })).toBe(4)
    expect(drop({ x: 45, y: -80 })).toBe(2)
  })

  it('lands nowhere out of reach, on a Leaf, or back where it came from', () => {
    expect(drop({ x: 0, y: 0 })).toBeUndefined()
    expect(drop({ x: 98, y: 4 })).toBeUndefined()
    expect(drop({ x: -50, y: -87 })).toBeUndefined()
  })
})
