import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DevUnauthenticated } from '#/api/dev/failures'
import { Unexpected, encodeFailure, type Failure, type Outcome } from '#/api/report/errors/failure'
import { forget, identify } from '#/api/report/observability/client'
import { session } from '#/api/iam/iam'

import { CallFailed } from '../calls'
import { continueTo, readSignInSearch, sessionIfAny } from './guard'

vi.mock('#/api/iam/iam', () => ({ session: vi.fn() }))
vi.mock('#/api/report/observability/client', () => ({ identify: vi.fn(), forget: vi.fn() }))

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
    location: { href: 'http://localhost/', origin: 'http://localhost', assign },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("home's search param, signed out", () => {
  it('keep a path on this site, with its search and hash', () => {
    expect(readSignInSearch({ redirect: '/?help=true#x' })).toEqual({
      redirect: '/?help=true#x',
    })
  })

  it.each([
    ['a full URL', 'https://evil.example/x'],
    ['a protocol-relative URL', '//evil.example/x'],
    ['a backslash', '/\\evil.example'],
    ['a tab a browser would drop', '/\t/evil.example'],
    ['a newline a browser would drop', '/\n/evil.example'],
    ['a relative path', 'settings/keys'],
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
    continueTo('/?keys=true', 'a-1')
    expect(assign).toHaveBeenCalledExactlyOnceWith('/?keys=true')
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

describe("home's read of the Session", () => {
  const account = { id: 'a-1', email: 'ada@example.com' }

  it('puts the Session on the route context', async () => {
    const found = { account, expiresAt: new Date() }
    answering({ ok: true, value: found })
    expect(await sessionIfAny()).toEqual({ session: found })
  })

  it('ties the device to the Account whose Session it found', async () => {
    answering({ ok: true, value: { account, expiresAt: new Date() } })
    await sessionIfAny()
    expect(identify).toHaveBeenCalledExactlyOnceWith('a-1')
    expect(forget).not.toHaveBeenCalled()
  })

  it('unties the device from any Account when the visit is signed out', async () => {
    answering(failing(new DevUnauthenticated()))
    await sessionIfAny()
    expect(forget).toHaveBeenCalledOnce()
    expect(identify).not.toHaveBeenCalled()
  })

  it('shows a signed-out visit signed out, sending it nowhere', async () => {
    answering(failing(new DevUnauthenticated()))
    expect(await sessionIfAny()).toEqual({ session: undefined })
  })

  it('makes any other failure the route’s error', async () => {
    answering(failing(new Unexpected()))
    const thrown: unknown = await sessionIfAny().catch((error: unknown) => error)
    expect(thrown).toBeInstanceOf(CallFailed)
    expect(thrown).toMatchObject({ failure: { _tag: 'Unexpected' }, scope: 'session' })
  })
})
