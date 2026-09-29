import { describe, expect, it } from 'vitest'

import { redacted, scrubbed, scrubbedBreadcrumb } from './sentry'

const token = 'aB3dE6gH9jK2mN5pQ8sT1vW4yZ7'

describe('what Sentry keeps of an error', () => {
  it('redacts an email address and anything that could be a token', () => {
    expect(redacted(`Key (email)=(ada@example.com) already exists, session ${token}`)).toBe(
      'Key (email)=([redacted]) already exists, session [redacted]',
    )
  })

  it('leaves a message with nothing sensitive as it is', () => {
    expect(redacted('A server function failed unexpectedly')).toBe(
      'A server function failed unexpectedly',
    )
  })

  it("keeps a request's method and path, and drops its query, headers, cookies, body and user", () => {
    const event = scrubbed({
      user: { id: 'account-1', email: 'ada@example.com' },
      request: {
        method: 'POST',
        url: `https://hexframe.app/reset/${token}?email=ada@example.com#x`,
        headers: { cookie: 'session=secret' },
        cookies: { session: 'secret' },
        data: { password: 'lovelace1815' },
        query_string: 'email=ada@example.com',
      },
    })
    expect(event.user).toBeUndefined()
    expect(event.request).toEqual({ method: 'POST', url: 'https://hexframe.app/reset/[redacted]' })
  })

  it("redacts the event's message and every exception's value, and keeps the rest", () => {
    const event = scrubbed({
      message: 'Signing in ada@example.com failed',
      exception: { values: [{ type: 'Error', value: 'duplicate key: ada@example.com' }] },
      tags: { requestId: 'req-1' },
    })
    expect(event.message).toBe('Signing in [redacted] failed')
    expect(event.exception.values).toEqual([{ type: 'Error', value: 'duplicate key: [redacted]' }])
    expect(event.tags).toEqual({ requestId: 'req-1' })
  })

  it('drops console breadcrumbs, which print anything', () => {
    expect(scrubbedBreadcrumb({ category: 'console', message: 'the password is x' })).toBeNull()
  })

  it("strips a navigation's and a fetch's URLs of their query", () => {
    expect(
      scrubbedBreadcrumb({
        category: 'navigation',
        data: { from: '/sign-in?redirect=/tiles', to: '/tiles?email=ada@example.com' },
      }),
    ).toMatchObject({ data: { from: '/sign-in', to: '/tiles' } })
    expect(
      scrubbedBreadcrumb({ category: 'fetch', data: { url: '/_serverFn/x?payload=secret' } }),
    ).toMatchObject({ data: { url: '/_serverFn/x' } })
  })
})
