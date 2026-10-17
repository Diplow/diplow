import { describe, expect, it } from 'vitest'

import { countOf, lengthOf } from './count'

describe('lengthOf', () => {
  it('counts an emoji of several code points as one, as a reader does', () => {
    expect(lengthOf('👩‍💻')).toBe(1)
    expect(lengthOf('é')).toBe(1)
    expect(lengthOf('hexframe')).toBe(8)
  })
})

describe('countOf', () => {
  it('shows nothing while the text is far from its limit', () => {
    expect(countOf('a'.repeat(279), 350)).toBeUndefined()
    expect(countOf('', 32)).toBeUndefined()
  })

  it('shows the count, quiet, from four fifths of the limit', () => {
    expect(countOf('a'.repeat(280), 350)).toEqual({ length: 280, limit: 350, tone: 'quiet' })
  })

  it('turns near the end for the last tenth, the limit itself included', () => {
    expect(countOf('a'.repeat(315), 350)?.tone).toBe('quiet')
    expect(countOf('a'.repeat(316), 350)?.tone).toBe('near')
    expect(countOf('a'.repeat(350), 350)?.tone).toBe('near')
    expect(countOf('a'.repeat(29), 32)?.tone).toBe('near')
  })

  it('turns over past the limit', () => {
    expect(countOf('a'.repeat(351), 350)).toEqual({ length: 351, limit: 350, tone: 'over' })
  })

  it('counts emoji as a reader does on the way', () => {
    expect(countOf('👩‍💻'.repeat(33), 32)?.tone).toBe('over')
  })
})
