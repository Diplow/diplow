import { describe, expect, it } from 'vitest'

import {
  bow,
  cutAlongCurve,
  offsetAt,
  scrollTopAt,
  thumbOf,
  type Scroll,
  type Track,
} from './curve'

const track: Track = { height: 1000, top: 100, length: 700 }
const scroll: Scroll = { top: 0, height: 2800, client: 700 }

describe('offsetAt', () => {
  it('leaves the edge at the top and the foot, and bows half its control point at mid-height', () => {
    expect(offsetAt(0)).toBe(0)
    expect(offsetAt(1)).toBe(0)
    expect(offsetAt(0.5)).toBe(bow / 2)
  })
})

describe('cutAlongCurve', () => {
  it('runs from the column’s top-left corner down the curve and back along its foot', () => {
    const cut = cutAlongCurve('var(--edge)', 4)
    expect(cut).toBe(
      'polygon(0 0, calc(var(--edge) + 0px) 0%, calc(var(--edge) + 27px) 25%, ' +
        'calc(var(--edge) + 36px) 50%, calc(var(--edge) + 27px) 75%, ' +
        'calc(var(--edge) + 0px) 100%, 0 100%)',
    )
  })
})

describe('thumbOf', () => {
  it('shows no star while everything shows', () => {
    expect(thumbOf(track, { top: 0, height: 700, client: 700 })).toBeUndefined()
  })

  it('lights a stretch in proportion to what shows, never shorter than a star you can catch', () => {
    expect(thumbOf(track, scroll)?.size).toBe(175)
    expect(thumbOf(track, { top: 0, height: 70_000, client: 700 })?.size).toBe(64)
  })

  it('sits at the track’s top when scrolled to the top, at its foot when scrolled to the foot', () => {
    const atTop = thumbOf(track, scroll)
    const atFoot = thumbOf(track, { ...scroll, top: 2100 })
    expect(atTop?.y).toBe(track.top + 175 / 2)
    expect(atFoot?.y).toBe(track.top + track.length - 175 / 2)
  })

  it('rides the curve, its rays along it: leaning out above mid-height, upright at it', () => {
    const middle = thumbOf(
      { height: 1000, top: 0, length: 1000 },
      { top: 500, height: 2000, client: 1000 },
    )
    expect(middle?.y).toBe(500)
    expect(middle?.x).toBe(bow / 2)
    expect(middle?.angle).toBeCloseTo(0)
    const above = thumbOf(track, scroll)
    expect(above?.x).toBeCloseTo(offsetAt((above?.y ?? 0) / track.height))
    expect(above?.angle).toBeLessThan(0)
  })
})

describe('scrollTopAt', () => {
  it('scrolls so the star lands where the track was clicked, within the scroll there is', () => {
    const over = scroll.height - scroll.client
    expect(scrollTopAt(track, scroll, track.top)).toBe(0)
    expect(scrollTopAt(track, scroll, track.top + track.length)).toBe(over)
    expect(scrollTopAt(track, scroll, track.top + track.length / 2)).toBeCloseTo(over / 2)
    // Back and forth: the scroll it gives puts the star where it was asked to be.
    const asked = 400
    const top = scrollTopAt(track, scroll, asked)
    expect(thumbOf(track, { ...scroll, top })?.y).toBeCloseTo(asked)
  })

  it('stays at the top while there is nothing to scroll', () => {
    expect(scrollTopAt(track, { top: 0, height: 700, client: 700 }, 500)).toBe(0)
  })
})
