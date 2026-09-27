import { describe, expect, it } from 'vitest'

import { requestContext } from './middleware'

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
  return context as { requestId: string }
}

describe('the request context middleware', () => {
  it('passes a request id on to the handler', async () => {
    expect((await passedOn()).requestId).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('gives each request its own', async () => {
    expect((await passedOn()).requestId).not.toBe((await passedOn()).requestId)
  })
})
