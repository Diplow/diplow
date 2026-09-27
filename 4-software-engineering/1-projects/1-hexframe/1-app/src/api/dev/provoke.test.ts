import { describe, expect, it } from 'vitest'

import { run } from '../server/run'
import { outcomes, provoked, savedDevTitle } from './provoke'

const context = { requestId: 'req-dev' }

describe('the calls /dev/errors provokes', () => {
  it.each(outcomes.filter((outcome) => outcome !== 'Success'))(
    'ends with a failure of kind %s',
    async (kind) => {
      expect(await run(context, provoked(kind))).toMatchObject({
        ok: false,
        failure: { kind },
        requestId: 'req-dev',
      })
    },
  )

  it('succeeds with the request id', async () => {
    expect(await run(context, provoked('Success'))).toEqual({
      ok: true,
      value: { requestId: 'req-dev' },
    })
  })
})

describe("the dev form's write", () => {
  it.each(['', '   '])('is Invalid on the title when it is %j', async (title) => {
    expect(await run(context, savedDevTitle(title))).toMatchObject({
      ok: false,
      failure: { _tag: 'DevInvalid', fields: ['title'] },
    })
  })

  it.each(['taken', ' Taken '])('is a Conflict for %j', async (title) => {
    expect(await run(context, savedDevTitle(title))).toMatchObject({
      ok: false,
      failure: { _tag: 'DevConflict' },
    })
  })

  it('saves anything else, trimmed', async () => {
    expect(await run(context, savedDevTitle(' taken by Ulysse '))).toEqual({
      ok: true,
      value: { title: 'taken by Ulysse' },
    })
  })
})
