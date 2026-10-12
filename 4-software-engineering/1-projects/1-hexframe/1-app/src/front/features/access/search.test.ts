import { describe, expect, it } from 'vitest'

import { accessOf, readAccessSearch, withAccess } from './search'

describe("signed out, home's choice between signing in and signing up", () => {
  it('reads signing up from the URL', () => {
    expect(accessOf(readAccessSearch({ access: 'sign-up' }))).toBe('sign-up')
  })

  it.each([
    ['absent', {}],
    ['anything else', { access: 'sign-in' }],
    ['not a string', { access: 3 }],
  ])('signs in when %s', (_, search) => {
    expect(accessOf(readAccessSearch(search))).toBe('sign-in')
  })

  it('writes nothing for signing in, so the URL stays bare', () => {
    expect(withAccess('sign-in')).toEqual({ access: undefined })
    expect(withAccess('sign-up')).toEqual({ access: 'sign-up' })
  })
})
