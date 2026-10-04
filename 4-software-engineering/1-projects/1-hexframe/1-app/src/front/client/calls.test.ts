import { describe, expect, it } from 'vitest'

import { DevForbidden, DevInvalid } from '#/api/dev/failures'
import { Unexpected, encodeFailure, type Outcome } from '#/api/errors/failure'

import { CallFailed, settle } from './calls'

const failed = async (call: Promise<unknown>) => {
  try {
    await call
  } catch (error) {
    return error
  }
  throw new Error('the call did not fail')
}

describe('settling a call', () => {
  it('gives the value of a call that succeeded', async () => {
    const outcome: Outcome<number, never> = { ok: true, value: 42 }
    expect(await settle('answer', Promise.resolve(outcome))).toBe(42)
  })

  it('throws the failure decoded into its class, with its scope and request id', async () => {
    const outcome: Outcome<number, DevInvalid> = {
      ok: false,
      failure: encodeFailure(new DevInvalid({ fields: ['title'] })),
      requestId: 'req-1',
    }
    const error = await failed(settle('submitDevTitle', Promise.resolve(outcome)))
    expect(error).toBeInstanceOf(CallFailed)
    expect(error).toMatchObject({ scope: 'submitDevTitle', requestId: 'req-1' })
    expect((error as CallFailed).failure).toBeInstanceOf(DevInvalid)
  })

  it('keeps the class of each failure', async () => {
    const outcome: Outcome<number, DevForbidden> = {
      ok: false,
      failure: encodeFailure(new DevForbidden()),
      requestId: 'req-2',
    }
    const error = (await failed(settle('provokeRead', Promise.resolve(outcome)))) as CallFailed
    expect(error.failure).toBeInstanceOf(DevForbidden)
  })

  it.each([null, undefined, 'Not Found', { value: 1 }])(
    'throws Unexpected when the answer is no outcome: %j',
    async (answer) => {
      const call = Promise.resolve(answer as unknown as Outcome<number, never>)
      const error = (await failed(settle('provokeRead', call))) as CallFailed
      expect(error).toBeInstanceOf(CallFailed)
      expect(error.failure).toBeInstanceOf(Unexpected)
    },
  )

  it('throws Unexpected, with no request id, when the call never reached the helper', async () => {
    const error = (await failed(
      settle('provokeRead', Promise.reject(new TypeError('offline'))),
    )) as CallFailed
    expect(error).toBeInstanceOf(CallFailed)
    expect(error.failure).toBeInstanceOf(Unexpected)
    expect(error.requestId).toBeUndefined()
  })
})
