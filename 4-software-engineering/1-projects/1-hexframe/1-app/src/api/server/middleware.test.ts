import { Exit, Option } from 'effect'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { signUp } from '#/domains/iam/iam'

import { requestContext, sameOriginOnly } from './middleware'
import { run, type StartContext } from './run'

// The request Start is handling; Nitro puts the platform's waitUntil on it, when the platform has one.
let request: Request = new Request('http://localhost/_serverFn')
let response = new Headers()

vi.mock('@tanstack/react-start/server', () => ({
  getRequest: () => request,
  getResponseHeaders: () => response,
}))

afterEach(() => {
  request = new Request('http://localhost/_serverFn')
  response = new Headers()
})

// Start calls the server half with `next`; the context it passes on is what every handler receives.
const passedOn = async () => {
  const server = requestContext.options.server
  if (server === undefined) throw new Error('the middleware has no server half')
  let context: unknown
  await server({
    serverFnMeta: { id: 'fn-1', name: 'signUp', filename: 'src/api/domains/iam/iam.ts' },
    next: (options: { context: unknown }) => {
      context = options.context
      return Promise.resolve(options)
    },
  } as never)
  return context as StartContext
}

describe('the request context middleware', () => {
  it('passes a request id on to the handler', async () => {
    expect((await passedOn()).requestId).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('gives each request its own', async () => {
    expect((await passedOn()).requestId).not.toBe((await passedOn()).requestId)
  })

  it('scopes the request to the server function called, by its name', async () => {
    expect((await passedOn()).scope).toBe('signUp')
  })

  it("hands pending work to the platform's waitUntil", async () => {
    const waitUntil = vi.fn()
    request = Object.assign(new Request('http://localhost/_serverFn'), { waitUntil })
    const work = Promise.resolve()
    ;(await passedOn()).waitUntil(work)
    expect(waitUntil).toHaveBeenCalledWith(work)
  })

  it('lets the work run where the platform has no waitUntil', async () => {
    const { waitUntil } = await passedOn()
    expect(() => {
      waitUntil(Promise.resolve())
    }).not.toThrow()
  })

  it('puts no Session on a request without a session cookie', async () => {
    expect((await passedOn()).session).toEqual(Exit.succeed(Option.none()))
  })

  it('puts on the request the Session its cookie proves, and sends the cookies a call sets', async () => {
    const signingUp = await passedOn()
    const account = await run(
      signingUp,
      signUp({ email: 'ada@example.com', password: 'lovelace1815' }),
    )
    expect(account).toMatchObject({ ok: true, value: { email: 'ada@example.com' } })
    const cookies = response.getSetCookie()
    expect(cookies).not.toHaveLength(0)

    request = new Request('http://localhost/_serverFn', {
      headers: { cookie: cookies.map((cookie) => cookie.split(';')[0]).join('; ') },
    })
    const session = (await passedOn()).session
    expect(session).toEqual(
      Exit.succeed(
        Option.some(expect.objectContaining({ account: account.ok ? account.value : undefined })),
      ),
    )
  })
})

describe('the same-origin check before every server function', () => {
  const calling = async (headers: Record<string, string>, handlerType = 'serverFn') => {
    const server = sameOriginOnly.options.server
    if (server === undefined) throw new Error('the middleware has no server half')
    const call = new Request('http://localhost/_serverFn/abc', { method: 'POST', headers })
    const answer: unknown = await server({
      request: call,
      handlerType,
      next: () => Promise.resolve('handled'),
    } as never)
    return answer instanceof Response ? answer.status : answer
  }

  it('lets a call from this site through', async () => {
    expect(await calling({ 'sec-fetch-site': 'same-origin' })).toBe('handled')
    expect(await calling({ origin: 'http://localhost' })).toBe('handled')
  })

  it('refuses a call from another site with a 403, before anything runs', async () => {
    expect(await calling({ 'sec-fetch-site': 'cross-site' })).toBe(403)
    expect(await calling({ origin: 'https://evil.example' })).toBe(403)
    expect(await calling({ referer: 'https://evil.example/page' })).toBe(403)
    expect(await calling({})).toBe(403)
  })

  it('leaves page loads alone', async () => {
    expect(await calling({ 'sec-fetch-site': 'cross-site' }, 'router')).toBe('handled')
  })
})
