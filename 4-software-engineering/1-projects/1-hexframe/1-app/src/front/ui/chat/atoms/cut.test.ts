import { describe, expect, it } from 'vitest'

import { cutAround } from './cut'

describe('cutAround', () => {
  it('cuts a text around what was typed, where it first shows, case and accents aside', () => {
    expect(cutAround('Déplacer', 'depl')).toEqual({ before: '', match: 'Dépl', after: 'acer' })
    expect(cutAround('Software engineering', 'ENG')).toEqual({
      before: 'Software ',
      match: 'eng',
      after: 'ineering',
    })
  })

  it('keeps its place in decomposed text, a mark apart from its letter', () => {
    expect(cutAround('Déplacer', 'pla')).toEqual({
      before: 'Dé',
      match: 'pla',
      after: 'cer',
    })
  })

  it('cuts nothing when nothing was typed, or what was typed is not there', () => {
    expect(cutAround('Projects', '')).toBeUndefined()
    expect(cutAround('Projects', 'site')).toBeUndefined()
  })
})
