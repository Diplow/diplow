import type { Query } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { toast } from '#/ui/feedback/Toaster'

import { DevConflict, DevForbidden, DevInvalid, DevUnauthenticated } from '../dev/failures'
import { Unexpected, encodeFailure, type Failure, type Outcome } from '../errors/failure'
import { CallFailed, read, write } from './calls'
import { makeQueryClient, submitWrite } from './channels'

vi.mock('#/ui/feedback/Toaster', () => ({ toast: { error: vi.fn() } }))

const failing = <E extends Failure>(failure: E): Promise<Outcome<never, E>> =>
  Promise.resolve({ ok: false, failure: encodeFailure(failure), requestId: 'req-1' })

const assign = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('window', {
    location: {
      href: 'http://localhost/dev/errors?a=1#x',
      origin: 'http://localhost',
      pathname: '/dev/errors',
      search: '?a=1',
      hash: '#x',
      assign,
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("a form's write", () => {
  const submit = (call: () => Promise<Outcome<{ title: string }, Failure>>, onSaved = vi.fn()) =>
    submitWrite({ scope: 'submitDevTitle', call, onSaved })({ value: { title: 'x' } })

  it('hands the value to onSaved and reports no error', async () => {
    const onSaved = vi.fn()
    const saved = Promise.resolve({ ok: true as const, value: { title: 'x' } })
    expect(await submit(() => saved, onSaved)).toBeUndefined()
    expect(onSaved).toHaveBeenCalledWith({ title: 'x' })
  })

  it("puts an Invalid failure's message on the fields it names, and raises no toast", async () => {
    expect(await submit(() => failing(new DevInvalid({ fields: ['title'] })))).toEqual({
      fields: { title: 'Give it a title.' },
    })
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('raises one toast for any other failure, and keeps the submit from counting as done', async () => {
    expect(await submit(() => failing(new DevConflict()))).toEqual({
      form: 'That title is taken.',
    })
    expect(toast.error).toHaveBeenCalledExactlyOnceWith('That title is taken.')
  })
})

describe('the sign-in redirect', () => {
  // Fresh modules for each case, so the one-redirect flag in channels.ts starts down.
  const signingIn = async () => {
    vi.resetModules()
    const { submitWrite: fresh } = await import('./channels')
    const { DevUnauthenticated: SignedOut } = await import('../dev/failures')
    const { encodeFailure: encode } = await import('../errors/failure')
    const outcome = { ok: false as const, failure: encode(new SignedOut()), requestId: 'req-1' }
    const submit = fresh({ scope: 'save', call: () => Promise.resolve(outcome), onSaved: vi.fn() })
    return () => submit({ value: {} })
  }

  it('happens once, carrying the path, the search and the hash', async () => {
    const submit = await signingIn()
    await submit()
    await submit()
    expect(assign).toHaveBeenCalledExactlyOnceWith(
      `/sign-in?redirect=${encodeURIComponent('/dev/errors?a=1#x')}`,
    )
  })

  it('does nothing on the server, where there is no window to move', async () => {
    vi.unstubAllGlobals()
    const submit = await signingIn()
    await expect(submit()).resolves.toEqual({ form: 'Sign in to go on.' })
    expect(assign).not.toHaveBeenCalled()
  })
})

describe("the QueryClient's channels", () => {
  const client = makeQueryClient()
  const throwOnError = client.getDefaultOptions().queries?.throwOnError
  const inBoundary = (error: unknown, call: 'read' | 'frame') =>
    typeof throwOnError === 'function' &&
    throwOnError(error as CallFailed, { meta: { call }, queryKey: ['scope'] } as unknown as Query)

  it.each([
    ['Forbidden', new DevForbidden(), true],
    ['Conflict', new DevConflict(), true],
    ['Unexpected', new Unexpected(), true],
    ['Unauthenticated', new DevUnauthenticated(), false],
  ])("throws a read's %s failure to the nearest boundary: %s", (_, failure, expected) => {
    expect(inBoundary(new CallFailed(failure, 'scope'), 'read')).toBe(expected)
  })

  it("throws a read's raw error to the boundary as Unexpected", () => {
    expect(inBoundary(new Error('a bug'), 'read')).toBe(true)
  })

  it("never throws a frame read's failure", () => {
    expect(inBoundary(new CallFailed(new DevForbidden(), 'scope'), 'frame')).toBe(false)
  })

  it("reports a frame read's failure, and shows nothing", async () => {
    const report = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const frame = read({
      scope: 'header',
      key: [],
      call: () => failing(new DevConflict()),
      frame: true,
    })
    await expect(client.query(frame)).rejects.toBeInstanceOf(CallFailed)
    expect(report).toHaveBeenCalledWith('header failed: DevConflict (Conflict)', {
      requestId: 'req-1',
    })
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("raises one toast for a write's failure", async () => {
    const options = write('provokeWrite', () => failing(new DevForbidden()))
    const mutation = client.getMutationCache().build(client, options)
    await expect(mutation.execute(undefined)).rejects.toBeInstanceOf(CallFailed)
    expect(toast.error).toHaveBeenCalledExactlyOnceWith(
      "This belongs to someone who hasn't shared it with you.",
    )
  })
})
