import { describe, expect, it } from 'vitest'

import { fitAlone, fitWords as fitting, linesThatFit, type Fit } from './words'

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

  it("gives a title alone the hex's widest band, at any radius it shows alone", () => {
    for (const radius of [40, 70, 71]) {
      const fit = fitWords(radius)
      expect(fit.width).toBeCloseTo(radius * 1.62)
      expect(fit.height).toBeCloseTo(radius * 1.15)
    }
  })

  it('keeps the box with a preview inside the hex, whose slanted sides cut its corners', () => {
    // A pointy-top hex of radius r is r - |x| / √3 tall above its center at x.
    for (const radius of [72, 100, 138, 200]) {
      const { width, height } = fitWords(radius)
      expect(height / 2).toBeLessThanOrEqual(radius - width / 2 / Math.sqrt(3))
    }
  })
})

describe('fitAlone', () => {
  it('fits a small tile alone as a tile of the ring', () => {
    for (const radius of [20, 60, 120, 200]) expect(fitAlone(radius)).toEqual(fitting(radius))
  })

  it('grows its words on past 22px with the tile, up to a title of 44px', () => {
    expect(fitAlone(300)?.title).toBeCloseTo(33)
    expect(fitAlone(600)?.title).toBe(44)
    expect(fitAlone(600)?.capped).toBe(true)
  })

  it('sets the preview at half the title, between 15px and 21px', () => {
    expect(fitAlone(210)?.preview).toBe(15)
    expect(fitAlone(360)?.preview).toBeCloseTo(19.8)
    expect(fitAlone(600)?.preview).toBe(21)
  })

  it('gives its preview the box its hex holds, inside the slanted sides', () => {
    for (const radius of [300, 450, 600]) {
      const fit = fitAlone(radius)
      if (fit === undefined) throw new Error('No words')
      expect(fit.width).toBeCloseTo(radius * 1.3)
      expect(fit.height / 2).toBeLessThanOrEqual(radius - fit.width / 2 / Math.sqrt(3))
    }
  })
})

describe('linesThatFit', () => {
  it('counts the whole lines left under what sits above them', () => {
    expect(linesThatFit({ box: 100, above: 40, lineHeight: 14 })).toBe(4)
  })

  it('forgives a measure rounded down by a pixel', () => {
    expect(linesThatFit({ box: 68, above: 13, lineHeight: 14 })).toBe(4)
  })

  it('leaves none when not one line fits, or when nothing was measured', () => {
    expect(linesThatFit({ box: 40, above: 38, lineHeight: 14 })).toBe(0)
    expect(linesThatFit({ box: 40, above: 50, lineHeight: 14 })).toBe(0)
    expect(linesThatFit({ box: 40, above: 0, lineHeight: 0 })).toBe(0)
  })
})
