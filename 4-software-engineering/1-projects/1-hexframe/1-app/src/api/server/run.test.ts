import { Cause, Effect, Exit, Option } from 'effect'
import { describe, expect, it, vi } from 'vitest'

import { Bus } from '#/domains/bus'
import { CurrentSession } from '#/domains/iam/iam'
import { HttpExchange } from '#/repositories/auth/auth'

import { DevConflict, DevInvalid } from '../dev/failures'
import { WaitUntil } from './bus'
import { RequestContext, run, type StartContext } from './run'

// A signed-out request.
const context: StartContext = {
  requestId: 'req-1',
  scope: 'test',
  waitUntil: () => undefined,
  exchange: {
    url: 'http://localhost/_serverFn',
    headers: new Headers(),
    setCookies: () => undefined,
  },
  session: Exit.succeed(Option.none()),
}

describe('the server function helper', () => {
  it('returns the value of a program that succeeds', async () => {
    expect(await run(context, Effect.succeed(42))).toEqual({ ok: true, value: 42 })
  })

  it("provides Start's context as the RequestContext service", async () => {
    const program = Effect.gen(function* () {
      const { requestId } = yield* RequestContext
      return requestId
    })
    expect(await run(context, program)).toEqual({ ok: true, value: 'req-1' })
  })

  it('provides the bus, where a program publishes without waiting for anyone', async () => {
    const program = Effect.gen(function* () {
      const bus = yield* Bus
      yield* bus.publish({ _tag: 'DevHappened' })
      return 'published'
    })
    expect(await run(context, program)).toEqual({ ok: true, value: 'published' })
  })

  it("hands the work a program leaves pending to the platform's waitUntil, as a promise", async () => {
    let ran = false
    const kept: Array<Promise<unknown>> = []
    const program = Effect.gen(function* () {
      const waitUntil = yield* Effect.serviceOption(WaitUntil)
      if (Option.isSome(waitUntil)) {
        waitUntil.value(
          Effect.sync(() => {
            ran = true
          }),
        )
      }
    })
    await run({ ...context, waitUntil: (promise) => kept.push(promise) }, program)
    await Promise.all(kept)
    expect(ran).toBe(true)
  })

  it("hands PostHog's flush to waitUntil, whether the program succeeds or fails", async () => {
    for (const program of [Effect.succeed(1), Effect.die(new Error('a bug'))]) {
      const kept: Array<Promise<unknown>> = []
      await run({ ...context, waitUntil: (promise) => kept.push(promise) }, program)
      expect(kept).toHaveLength(1)
      await Promise.all(kept)
    }
  })

  it("provides the request's Session and its HttpExchange as services", async () => {
    const session = { account: { id: 'a-1', email: 'ada@example.com' }, expiresAt: new Date() }
    const program = Effect.gen(function* () {
      return { session: yield* CurrentSession, url: (yield* HttpExchange).url }
    })
    expect(await run({ ...context, session: Exit.succeed(Option.some(session)) }, program)).toEqual(
      { ok: true, value: { session: Option.some(session), url: 'http://localhost/_serverFn' } },
    )
  })

  it('logs the call even when the Session could not be resolved', async () => {
    const lines: Array<string> = []
    const print = (...parts: Array<unknown>) => void lines.push(parts.map(String).join(' '))
    for (const method of ['log', 'info', 'error'] as const) {
      vi.spyOn(console, method).mockImplementation(print)
    }
    await run({ ...context, session: Exit.die(new Error('down')) }, Effect.succeed(1))
    vi.restoreAllMocks()
    expect(lines.some((line) => line.includes('Server function called'))).toBe(true)
  })

  it('sends Unexpected when the Session could not be resolved, whatever the program', async () => {
    const lost = { ...context, session: Exit.die(new Error('the database is down')) }
    const outcome = await run(lost, Effect.succeed('never reached'))
    expect(outcome).toMatchObject({ ok: false, failure: { _tag: 'Unexpected' } })
    expect(JSON.stringify(outcome)).not.toContain('database')
  })

  it('sends Unexpected when an interruption sits beside a declared failure', async () => {
    const both = Cause.combine(Cause.fail(new DevConflict()), Cause.interrupt())
    expect(await run(context, Effect.failCause(both))).toMatchObject({
      ok: false,
      failure: { _tag: 'Unexpected' },
    })
  })

  it('sends a declared failure encoded, with the request id', async () => {
    expect(await run(context, Effect.fail(new DevInvalid({ fields: ['title'] })))).toEqual({
      ok: false,
      failure: { _tag: 'DevInvalid', kind: 'Invalid', fields: ['title'] },
      requestId: 'req-1',
    })
    const conflict = await run(context, Effect.fail(new DevConflict()))
    expect(conflict).toMatchObject({ ok: false, failure: { _tag: 'DevConflict' } })
  })

  it('sends a defect as Unexpected, never as it is', async () => {
    const outcome = await run(context, Effect.die(new Error('the database is down')))
    expect(outcome).toEqual({
      ok: false,
      failure: { _tag: 'Unexpected', kind: 'Unexpected' },
      requestId: 'req-1',
    })
    expect(JSON.stringify(outcome)).not.toContain('database')
  })

  it('sends Unexpected when a defect sits beside a declared failure', async () => {
    const both = Cause.combine(Cause.fail(new DevConflict()), Cause.die(new Error('lost')))
    expect(await run(context, Effect.failCause(both))).toMatchObject({
      ok: false,
      failure: { _tag: 'Unexpected' },
    })
  })

  it('sends Unexpected for a failure the union does not know', async () => {
    // Only an untyped path can get one past `run`'s type; the helper still refuses to send it.
    const stray = Effect.fail({ _tag: 'TileMissing', kind: 'NotFound' } as unknown as DevConflict)
    expect(await run(context, stray)).toMatchObject({ ok: false, failure: { _tag: 'Unexpected' } })
  })

  it('sends an exception thrown inside the program as Unexpected', async () => {
    const program = Effect.sync(() => {
      throw new Error('a bug')
    })
    expect(await run(context, program)).toMatchObject({
      ok: false,
      failure: { _tag: 'Unexpected' },
    })
  })
})
