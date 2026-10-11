import { describe, expect, it } from 'vitest'

import { firstMode, routeOf } from './proposal'

// The Mode and a write's route, on values made by hand. That a Turn keeps the Mode it started in, and
// is routed by it, over the repositories, is `../../proposals.test.ts`'s.

describe('the Mode and the route a Turn writes by', () => {
  it('starts a Conversation in ask', () => {
    expect(firstMode).toBe('ask')
  })

  it('drafts the writes of a Turn in ask, and applies those of a Turn in apply', () => {
    expect(routeOf({ mode: 'ask' })).toBe('draft')
    expect(routeOf({ mode: 'apply' })).toBe('apply')
  })
})
