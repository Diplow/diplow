import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'

import { DevConflict, DevInvalid } from '../dev/failures'
import { RequestContext, run } from './run'

const context = { requestId: 'req-1' }

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
