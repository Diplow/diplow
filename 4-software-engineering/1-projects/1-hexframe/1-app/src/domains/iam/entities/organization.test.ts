import { describe, expect, it } from 'vitest'

import { groupNameBounds, groupNameOf, sameGroupName } from './organization'

// A Group's name, IAM's rule: trimmed, counted as a reader counts it, one per Organization whatever
// its case.

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
