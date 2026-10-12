import { defaultStringifySearch } from '@tanstack/react-router'
import { describe, expect, it } from 'vitest'

import { accessOf, readAccessSearch, wayBack, withAccess } from './search'

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

describe('where signing in goes back to', () => {
  it('is where the user was sent from', () => {
    expect(wayBack('/design-system#Canvas', { keys: true }, defaultStringifySearch)).toBe(
      '/design-system#Canvas',
    )
  })

  it('is else home with the widgets open in its chat, as the router writes them', () => {
    expect(wayBack(undefined, { keys: true, help: 'help/3' }, defaultStringifySearch)).toBe(
      '/?keys=true&help=help%2F3',
    )
  })

  it('is home bare when none is open', () => {
    expect(wayBack(undefined, { keys: undefined, help: undefined }, defaultStringifySearch)).toBe(
      '/',
    )
  })
})
