import { describe, expect, it } from 'vitest'

import { fitWords as fitting, linesThatFit, type Fit } from './words'

function fitWords(radius: number): Fit {
  const fit = fitting(radius)
  if (fit === undefined) throw new Error(`No words at a radius of ${String(radius)}`)
  return fit
}

describe('fitWords', () => {
  it('lays the title out at 16px on a tile of radius 100, and its preview at two thirds', () => {
    const fit = fitWords(100)
    expect(fit.title).toBeCloseTo(16)
    expect(fit.preview).toBeCloseTo(16 * (2 / 3))
    expect(fit.capped).toBe(false)
  })

  it('scales the title with the tile, then stops it at 22px', () => {
    expect(fitWords(120).title).toBeCloseTo(19.2)
    expect(fitWords(200).title).toBe(22)
    expect(fitWords(200).capped).toBe(true)
  })

  it('stops the box with the title, so the light grows around words that keep their size', () => {
    expect(fitWords(300).width).toBeCloseTo(fitWords(200).width)
    expect(fitWords(300).height).toBeCloseTo(fitWords(200).height)
  })

  it('shows the title alone under a radius of 72, never below 11px', () => {
    expect(fitWords(71).preview).toBeUndefined()
    expect(fitWords(72).preview).toBeDefined()
    expect(fitWords(34).title).toBe(11)
  })

  it('leaves a tile under a radius of 30 a light without words', () => {
    expect(fitting(29)).toBeUndefined()
    expect(fitting(30)).toBeDefined()
  })

  it("gives a title held at 11px the hex's widest band", () => {
    const fit = fitWords(40)
    expect(fit.width).toBeCloseTo(40 * 1.62)
    expect(fit.height).toBeCloseTo(40 * 1.15)
  })

  it('keeps the box inside the hex, whose slanted sides cut its corners', () => {
    // A pointy-top hex of radius r is r - |x| / √3 tall above its center at x.
    for (const radius of [34, 72, 100, 138, 200]) {
      const { width, height } = fitWords(radius)
      if (radius < 72) continue
      expect(height / 2).toBeLessThanOrEqual(radius - width / 2 / Math.sqrt(3))
    }
  })
})

describe('linesThatFit', () => {
  it('counts the whole lines left under what sits above them', () => {
    expect(linesThatFit({ box: 100, above: 40, lineHeight: 14 })).toBe(4)
  })

  it('forgives a measure rounded down by a pixel', () => {
    expect(linesThatFit({ box: 69, above: 13, lineHeight: 14 })).toBe(4)
  })

  it('leaves none when not one line fits, or when nothing was measured', () => {
    expect(linesThatFit({ box: 40, above: 38, lineHeight: 14 })).toBe(0)
    expect(linesThatFit({ box: 40, above: 50, lineHeight: 14 })).toBe(0)
    expect(linesThatFit({ box: 40, above: 0, lineHeight: 0 })).toBe(0)
  })
})
