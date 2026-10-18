import { describe, expect, it } from 'vitest'

import { groupNameBounds, groupNameOf, keyNameBounds, keyNameOf, sameGroupName } from './names'

/** One character to a reader, eleven UTF-16 units: a family of four, joined. */
const family = '\u{1F468}‍\u{1F469}‍\u{1F467}‍\u{1F466}'

describe("a Key's name", () => {
  it('holds 1 to 32 characters', () => {
    expect(keyNameBounds).toEqual({ min: 1, max: 32 })
  })

  it('is kept trimmed', () => {
    expect(keyNameOf('  Claude Code, laptop  ')).toBe('Claude Code, laptop')
    expect(keyNameOf(`  ${'x'.repeat(32)}  `)).toBe('x'.repeat(32))
  })

  it('is counted as a reader counts it, an emoji one character', () => {
    expect(keyNameOf(family.repeat(32))).toBe(family.repeat(32))
    expect(keyNameOf(family.repeat(33))).toBeUndefined()
  })

  it('is refused empty, of spaces only, or past 32 characters', () => {
    for (const name of ['', '   ', 'x'.repeat(33)]) expect(keyNameOf(name)).toBeUndefined()
  })
})

describe('a Group’s name', () => {
  it('is trimmed, and refused blank or past its bound, counted as a reader counts it', () => {
    expect(groupNameOf('  Design  ')).toBe('Design')
    expect(groupNameOf('   ')).toBeUndefined()
    expect(groupNameOf('x'.repeat(groupNameBounds.max))).toHaveLength(groupNameBounds.max)
    expect(groupNameOf('x'.repeat(groupNameBounds.max + 1))).toBeUndefined()
    // Forty emoji of several code points each are forty characters.
    expect(groupNameOf('👩‍🎨'.repeat(groupNameBounds.max))).toBeDefined()
  })

  it('is one with another whatever their case', () => {
    expect(sameGroupName('Design', 'design')).toBe(true)
    expect(sameGroupName('Design', 'Designers')).toBe(false)
  })
})
