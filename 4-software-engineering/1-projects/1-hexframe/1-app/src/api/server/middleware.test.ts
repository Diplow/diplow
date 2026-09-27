import { afterEach, describe, expect, it, vi } from 'vitest'

import { requestContext } from './middleware'
import type { StartContext } from './run'

// The request Start is handling; Nitro puts the platform's waitUntil on it, when the platform has one.
let request: Request = new Request('http://localhost/_serverFn')

vi.mock('@tanstack/react-start/server', () => ({ getRequest: () => request }))

afterEach(() => {
  request = new Request('http://localhost/_serverFn')
})

// Start calls the server half with `next`; the context it passes on is what every handler receives.
const passedOn = async () => {
  const server = requestContext.options.server
  if (server === undefined) throw new Error('the middleware has no server half')
  let context: unknown
  await server({
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
})
