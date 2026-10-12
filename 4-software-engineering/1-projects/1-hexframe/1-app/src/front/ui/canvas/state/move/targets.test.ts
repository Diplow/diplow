import { describe, expect, it } from 'vitest'

import { nearestOf } from './targets'

// Where a drag let go lands among the places drawn: the nearest heart within its reach, or none.

const places = [
  { key: 'east', center: { x: 100, y: 0 }, reach: 40 },
  { key: 'west', center: { x: -100, y: 0 }, reach: 40 },
  { key: 'further-east', center: { x: 130, y: 0 }, reach: 40 },
]

describe('nearestOf', () => {
  it('lands on the place whose heart is nearest, within its reach', () => {
    expect(nearestOf({ x: -90, y: 10 }, places)?.key).toBe('west')
    expect(nearestOf({ x: 110, y: 0 }, places)?.key).toBe('east')
    expect(nearestOf({ x: 120, y: 0 }, places)?.key).toBe('further-east')
  })

  it('lands nowhere out of every reach, nor among no places', () => {
    expect(nearestOf({ x: 0, y: 0 }, places)).toBeUndefined()
    expect(nearestOf({ x: 100, y: 0 }, places.slice(0, 0))).toBeUndefined()
  })
})
