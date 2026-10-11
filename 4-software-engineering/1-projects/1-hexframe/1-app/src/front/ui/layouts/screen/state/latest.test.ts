import { describe, expect, it } from 'vitest'

import { keptAtFoot } from './latest'

// Whether the screen keeps following the conversation's foot, after each thing the reader does.

describe('the conversation kept at its foot', () => {
  it('follows the reader scrolling: at the foot, it is kept there; scrolled up, it is let go', () => {
    expect(keptAtFoot({ kind: 'scrolled', atFoot: true })).toBe(true)
    expect(keptAtFoot({ kind: 'scrolled', atFoot: false })).toBe(false)
  })

  it('stays kept when the reader acts at the foot of a conversation that scrolls', () => {
    expect(keptAtFoot({ kind: 'acted', atFoot: true, scrolls: true })).toBe(true)
  })

  it('is let go when the reader acts in a conversation too short to scroll, so an earlier day stays in view', () => {
    expect(keptAtFoot({ kind: 'acted', atFoot: true, scrolls: false })).toBe(false)
  })

  it('is let go when the reader acts above the foot', () => {
    expect(keptAtFoot({ kind: 'acted', atFoot: false, scrolls: true })).toBe(false)
  })

  it('is kept again once the reader writes at the foot', () => {
    expect(keptAtFoot({ kind: 'wrote' })).toBe(true)
  })
})
