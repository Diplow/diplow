import { describe, expect, it } from 'vitest'

import { readKeysSearch, withKeys } from './search'

describe("home's search param for the key widget", () => {
  it('reads it open', () => {
    expect(readKeysSearch({ keys: true })).toEqual({ keys: true })
  })

  it.each([
    ['absent', {}],
    ['false', { keys: false }],
    ['a string', { keys: 'yes' }],
  ])('reads it closed when %s', (_, search) => {
    expect(readKeysSearch(search)).toEqual({ keys: undefined })
  })

  it('writes it open, or nothing once closed', () => {
    expect(withKeys(true)).toEqual({ keys: true })
    expect(withKeys(false)).toEqual({ keys: undefined })
  })
})
