import type { MutationOptions, Query } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { toast } from '#/front/ui/feedback/Toaster'
import { DevConflict, DevForbidden, DevInvalid, DevUnauthenticated } from '#/api/dev/failures'
import { Unexpected, encodeFailure, type Failure, type Outcome } from '#/api/errors/failure'

import { CallFailed, read, write } from './calls'
import { caught, makeQueryClient, submitMutation, submitWrite } from './channels'

vi.mock('#/front/ui/feedback/Toaster', () => ({ toast: { error: vi.fn() } }))
vi.mock('#/api/observability/client', async (original) => ({
  ...(await original<object>()),
  forget: vi.fn(),
}))

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

afterEach(async () => {
  // A case sets the page's language on the runtime it imported; the next starts from English.
  const { overwriteGetLocale } = await import('#/paraglide/runtime')
  overwriteGetLocale(() => 'en')
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
    const onSaved = vi.fn()
    expect(await submit(() => failing(new DevConflict()), onSaved)).toEqual({
      form: 'That title is taken.',
    })
    expect(toast.error).toHaveBeenCalledExactlyOnceWith('That title is taken.')
    expect(onSaved).not.toHaveBeenCalled()
  })
})

describe("a form's write through a mutation", () => {
  /** Submits the dev title form through a `submit` write whose server function answers `answer`. */
  const submit = (
    answer: () => Promise<Outcome<{ title: string }, Failure>>,
    onSaved = vi.fn(),
  ) => {
    const client = makeQueryClient()
    const options = write('submitDevTitle', answer, { as: 'submit' })
    return submitMutation({
      scope: 'submitDevTitle',
      mutate: (value: { title: string }) =>
        client.getMutationCache().build(client, options).execute(value),
      onSaved,
    })({ value: { title: 'x' } })
  }

  it('hands the value to onSaved and shows nothing', async () => {
    const onSaved = vi.fn()
    const saved = Promise.resolve({ ok: true as const, value: { title: 'x' } })
    expect(await submit(() => saved, onSaved)).toBeUndefined()
    expect(onSaved).toHaveBeenCalledWith({ title: 'x' })
  })

  it("shows an Invalid failure's message on the fields it names, and raises no toast", async () => {
    expect(await submit(() => failing(new DevInvalid({ fields: ['title'] })))).toEqual({
      fields: { title: 'Give it a title.' },
    })
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('shows it in the page’s language', async () => {
    const { overwriteGetLocale } = await import('#/paraglide/runtime')
    overwriteGetLocale(() => 'fr')
    expect(await submit(() => failing(new DevInvalid({ fields: ['title'] })))).toEqual({
      fields: { title: 'Donnez-lui un titre.' },
    })
  })

  it('raises one toast for any other failure, and keeps the submit from counting as done', async () => {
    const onSaved = vi.fn()
    expect(await submit(() => failing(new DevConflict()), onSaved)).toEqual({
      form: 'That title is taken.',
    })
    expect(toast.error).toHaveBeenCalledExactlyOnceWith('That title is taken.')
    expect(onSaved).not.toHaveBeenCalled()
  })
})

describe('the sign-in redirect', () => {
  // Fresh modules for each case, so the one-redirect flag in channels.ts starts down.
  const signingIn = async () => {
    vi.resetModules()
    const { submitWrite: fresh } = await import('./channels')
    const { DevUnauthenticated: SignedOut } = await import('#/api/dev/failures')
    const { encodeFailure: encode } = await import('#/api/errors/failure')
    const { forget } = await import('#/api/observability/client')
    const outcome = { ok: false as const, failure: encode(new SignedOut()), requestId: 'req-1' }
    const submit = fresh({ scope: 'save', call: () => Promise.resolve(outcome), onSaved: vi.fn() })
    return Object.assign(() => submit({ value: {} }), { forget: vi.mocked(forget) })
  }

  it('happens once, carrying the path, the search and the hash', async () => {
    const submit = await signingIn()
    await submit()
    await submit()
    expect(assign).toHaveBeenCalledExactlyOnceWith(
      `/sign-in?redirect=${encodeURIComponent('/dev/errors?a=1#x')}`,
    )
  })

  it('unties this device from the Account whose Session ended, before it leaves', async () => {
    const submit = await signingIn()
    await submit()
    expect(submit.forget).toHaveBeenCalledOnce()
    const [forgotten] = submit.forget.mock.invocationCallOrder
    const [left] = assign.mock.invocationCallOrder
    expect(forgotten).toBeLessThan(left ?? 0)
  })

  it('carries the place without its language prefix, and signs in in that language', async () => {
    vi.stubGlobal('window', {
      location: {
        href: 'http://localhost/fr/dev/errors?a=1',
        origin: 'http://localhost',
        pathname: '/fr/dev/errors',
        search: '?a=1',
        hash: '',
        assign,
      },
    })
    const submit = await signingIn()
    // The page's language, as Paraglide reads it off the URL in a browser.
    const { overwriteGetLocale } = await import('#/paraglide/runtime')
    overwriteGetLocale(() => 'fr')
    await submit()
    expect(assign).toHaveBeenCalledExactlyOnceWith(
      `/fr/sign-in?redirect=${encodeURIComponent('/dev/errors?a=1')}`,
    )
  })

  it('does nothing on the server, where there is no window to move', async () => {
    vi.unstubAllGlobals()
    const submit = await signingIn()
    await expect(submit()).resolves.toEqual({ form: 'Sign in to go on.' })
    expect(assign).not.toHaveBeenCalled()
    expect(submit.forget).not.toHaveBeenCalled()
  })
})

describe("what a read's boundary caught", () => {
  it('reports a bug thrown while rendering, which nothing else saw', () => {
    const report = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const bug = new TypeError('a bug')
    caught(bug)
    expect(report).toHaveBeenCalledExactlyOnceWith(bug, {
      scope: 'render',
      kind: 'Unexpected',
      code: 'Unexpected',
    })
  })

  it("leaves a read's failure to the channel it went to already", () => {
    const report = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    caught(new CallFailed(new Unexpected(), 'scope'))
    expect(report).not.toHaveBeenCalled()
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

  it("leaves a frame read's failure to the server's report, and shows nothing", async () => {
    // The server logged the failure it sent, with this request id: the client reports it again nowhere.
    const report = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const frame = read({
      scope: 'header',
      key: [],
      call: () => failing(new DevConflict()),
      frame: true,
    })
    await expect(client.query(frame)).rejects.toBeInstanceOf(CallFailed)
    expect(report).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('reports a call that never reached the server, which has no report of it', async () => {
    const report = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const lost = new TypeError('Failed to fetch')
    const frame = read({ scope: 'header', key: [], call: () => Promise.reject(lost), frame: true })
    await expect(client.query(frame)).rejects.toBeInstanceOf(CallFailed)
    expect(report).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ cause: lost }), {
      scope: 'header',
      kind: 'Unexpected',
      code: 'Unexpected',
    })
  })

  /** Runs a mutation of the client above, for the error it ends with. */
  const executed = <A>(options: MutationOptions<A, CallFailed, undefined>) =>
    client.getMutationCache().build(client, options).execute(undefined)

  it("raises one toast for a write's failure", async () => {
    await expect(
      executed(write('provokeWrite', () => failing(new DevForbidden()))),
    ).rejects.toBeInstanceOf(CallFailed)
    expect(toast.error).toHaveBeenCalledExactlyOnceWith(
      "This belongs to someone who hasn't shared it with you.",
    )
  })

  it("raises one toast for a write's Invalid failure, which has no form to show it", async () => {
    await expect(
      executed(write('submitDevTitle', () => failing(new DevInvalid({ fields: ['title'] })))),
    ).rejects.toBeInstanceOf(CallFailed)
    expect(toast.error).toHaveBeenCalledExactlyOnceWith('Give it a title.')
  })

  it("leaves a submit's Invalid failure to the form's fields, and raises no toast", async () => {
    const options = write('submitDevTitle', () => failing(new DevInvalid({ fields: ['title'] })), {
      as: 'submit',
    })
    await expect(executed(options)).rejects.toBeInstanceOf(CallFailed)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("raises one toast for a submit's other failure", async () => {
    const options = write('submitDevTitle', () => failing(new DevConflict()), { as: 'submit' })
    await expect(executed(options)).rejects.toBeInstanceOf(CallFailed)
    expect(toast.error).toHaveBeenCalledExactlyOnceWith('That title is taken.')
  })

  it('reports a write that never reached the server under the scope its key names', async () => {
    const report = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const lost = new TypeError('Failed to fetch')
    await expect(
      executed(write('provokeWrite', () => Promise.reject(lost))),
    ).rejects.toBeInstanceOf(CallFailed)
    expect(report).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ cause: lost }), {
      scope: 'provokeWrite',
      kind: 'Unexpected',
      code: 'Unexpected',
    })
  })

  it('reports a mutation whose function threw no CallFailed under its key, as Unexpected', async () => {
    const report = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const bug = new TypeError('a bug')
    await expect(
      executed({ mutationKey: ['importTiles'], mutationFn: () => Promise.reject(bug) }),
    ).rejects.toBe(bug)
    expect(report).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ cause: bug }), {
      scope: 'importTiles',
      kind: 'Unexpected',
      code: 'Unexpected',
    })
    expect(toast.error).toHaveBeenCalledOnce()
  })
})
