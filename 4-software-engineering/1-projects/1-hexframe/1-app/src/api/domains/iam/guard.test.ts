import { isRedirect } from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SignedOut } from '#/domains/iam/errors'

import { CallFailed } from '../../client/calls'
import { Unexpected, encodeFailure, type Failure, type Outcome } from '../../errors/failure'
import { forget, identify } from '../../observability/client'
import { continueTo, readSignInSearch, signedInOnly } from './guard'
import { session } from './iam'

vi.mock('./iam', () => ({ session: vi.fn() }))
vi.mock('../../observability/client', () => ({ identify: vi.fn(), forget: vi.fn() }))

const answering = (outcome: Outcome<unknown, Failure>) => {
  vi.mocked(session).mockResolvedValue(outcome as never)
}

const failing = (failure: Failure): Outcome<never, Failure> => ({
  ok: false,
  failure: encodeFailure(failure),
  requestId: 'req-1',
})

const assign = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('window', {
    location: { href: 'http://localhost/sign-in', origin: 'http://localhost', assign },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("sign-in's search params", () => {
  it('keep a path on this site, with its search and hash', () => {
    expect(readSignInSearch({ redirect: '/dev/session?a=1#x' })).toEqual({
      redirect: '/dev/session?a=1#x',
    })
  })

  it.each([
    ['a full URL', 'https://evil.example/x'],
    ['a protocol-relative URL', '//evil.example/x'],
    ['a backslash', '/\\evil.example'],
    ['a tab a browser would drop', '/\t/evil.example'],
    ['a newline a browser would drop', '/\n/evil.example'],
    ['a relative path', 'dev/session'],
    ['something that is not a string', 42],
  ])('drop %s, so sign-in goes home', (_, redirect) => {
    expect(readSignInSearch({ redirect })).toEqual({ redirect: undefined })
  })

  it('go home when absent', () => {
    expect(readSignInSearch({})).toEqual({ redirect: undefined })
  })
})

describe('the way back once signed in', () => {
  it('goes where the user was, with a full load', () => {
    continueTo('/dev/session?a=1', 'a-1')
    expect(assign).toHaveBeenCalledExactlyOnceWith('/dev/session?a=1')
  })

  it('goes home without a place', () => {
    continueTo(undefined, 'a-1')
    expect(assign).toHaveBeenCalledExactlyOnceWith('/')
  })

  it('goes home when the place, resolved, is another site', () => {
    continueTo('//evil.example/x', 'a-1')
    expect(assign).toHaveBeenCalledExactlyOnceWith('/')
  })

  it('ties the device to the Account before it leaves', () => {
    continueTo(undefined, 'a-1')
    expect(identify).toHaveBeenCalledExactlyOnceWith('a-1')
  })
})

describe('the guard of a page only a signed-in Account sees', () => {
  const location = { href: '/dev/session?a=1' } as Parameters<typeof signedInOnly>[0]['location']
  const account = { id: 'a-1', email: 'ada@example.com' }

  it('puts the Session on the route context', async () => {
    const found = { account, expiresAt: new Date() }
    answering({ ok: true, value: found })
    expect(await signedInOnly({ location })).toEqual({ session: found })
  })

  it('ties the device to the Account whose Session it found', async () => {
    answering({ ok: true, value: { account, expiresAt: new Date() } })
    await signedInOnly({ location })
    expect(identify).toHaveBeenCalledExactlyOnceWith('a-1')
    expect(forget).not.toHaveBeenCalled()
  })

  it('unties the device from any Account when the visit is signed out', async () => {
    answering(failing(new SignedOut()))
    await signedInOnly({ location }).catch(() => undefined)
    expect(forget).toHaveBeenCalledOnce()
    expect(identify).not.toHaveBeenCalled()
  })

  it('redirects a signed-out visit to sign-in, carrying where it was', async () => {
    answering(failing(new SignedOut()))
    const thrown: unknown = await signedInOnly({ location }).catch((error: unknown) => error)
    expect(isRedirect(thrown)).toBe(true)
    expect(thrown).toMatchObject({
      options: { to: '/sign-in', search: { redirect: '/dev/session?a=1' } },
    })
  })

  it('makes any other failure the route’s error', async () => {
    answering(failing(new Unexpected()))
    const thrown: unknown = await signedInOnly({ location }).catch((error: unknown) => error)
    expect(thrown).toBeInstanceOf(CallFailed)
    expect(thrown).toMatchObject({ failure: { _tag: 'Unexpected' }, scope: 'session' })
  })
})
