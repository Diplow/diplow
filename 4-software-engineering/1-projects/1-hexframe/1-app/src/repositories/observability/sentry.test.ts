import { describe, expect, it } from 'vitest'

import { redacted, scrubbed, scrubbedBreadcrumb } from './sentry'

// A made-up session id: what matters is its length, which makes it look like one.
const token = 'x'.repeat(28)

describe('what Sentry keeps of an error', () => {
  it('redacts an email address and anything that could be a token', () => {
    expect(redacted(`Key (email)=(ada@example.com) already exists, session ${token}`)).toBe(
      'Key (email)=([redacted]) already exists, session [redacted]',
    )
  })

  it('redacts what a message quotes, however short, and keeps its quotes', () => {
    expect(redacted(`invalid input syntax for type uuid: "hunter2"`)).toBe(
      'invalid input syntax for type uuid: "[redacted]"',
    )
    expect(redacted("Cannot read properties of undefined (reading 'pw')")).toBe(
      "Cannot read properties of undefined (reading '[redacted]')",
    )
    expect(redacted("can't find the user's tile")).toBe("can't find the user's tile")
  })

  it('redacts a value a secret key names, and a one-time code or any long number', () => {
    expect(redacted('login failed: password=abc12, otp: 4321')).toBe(
      'login failed: password=[redacted], otp: [redacted]',
    )
    expect(redacted('code 123456 expired for +33612345678')).toBe(
      'code [redacted] expired for +[redacted]',
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

  it("strips a transaction's name, spans and trace of every query and sensitive run", () => {
    const event = scrubbed({
      type: 'transaction',
      transaction: 'GET /reset?email=ada@example.com',
      contexts: {
        trace: {
          trace_id: 't',
          span_id: 's',
          data: { 'url.full': `https://hexframe.app/reset/${token}?e=1`, 'url.query': 'e=1' },
        },
      },
      spans: [
        {
          span_id: 's-1',
          trace_id: 't',
          start_timestamp: 0,
          status: 'ok',
          op: 'http.client',
          description: 'GET https://api.example.com/tiles?owner=ada@example.com',
          data: {
            'http.url': 'https://api.example.com/tiles?owner=ada@example.com',
            'http.query': 'owner=ada@example.com',
            'http.fragment': 'x',
            'http.response.status_code': 200,
          },
        },
        {
          span_id: 's-2',
          trace_id: 't',
          start_timestamp: 0,
          status: 'ok',
          op: 'db',
          description: 'select * from tile where id = ?',
          data: {},
        },
      ],
    })
    expect(event.transaction).toBe('GET /reset')
    expect(event.contexts.trace.data).toEqual({
      'url.full': 'https://hexframe.app/reset/[redacted]',
    })
    expect(event.spans[0]).toMatchObject({
      description: 'GET https://api.example.com/tiles',
      data: { 'http.url': 'https://api.example.com/tiles', 'http.response.status_code': 200 },
    })
    expect(event.spans[0]?.data).not.toHaveProperty('http.query')
    expect(event.spans[0]?.data).not.toHaveProperty('http.fragment')
    expect(event.spans[1]?.description).toBe('select * from tile where id = ?')
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
