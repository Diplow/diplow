import { describe, expect, it } from 'vitest'

import { DevConflict, DevInvalid } from '../../dev/failures'
import { Unexpected, decodeFailure, encodeFailure } from './failure'

// What crosses the wire is JSON, whatever Start's serializer does on top.
const overTheWire = (value: unknown): unknown => JSON.parse(JSON.stringify(value))

describe('a failure on the wire', () => {
  it('is plain data carrying its tag and its kind', () => {
    expect(encodeFailure(new DevInvalid({ fields: ['title'] }))).toEqual({
      _tag: 'DevInvalid',
      kind: 'Invalid',
      fields: ['title'],
    })
  })

  it('comes back as its tagged class', () => {
    const decoded = decodeFailure(overTheWire(encodeFailure(new DevInvalid({ fields: ['title'] }))))
    expect(decoded).toBeInstanceOf(DevInvalid)
    expect(decoded).toMatchObject({ _tag: 'DevInvalid', kind: 'Invalid', fields: ['title'] })
  })

  it('keeps each class apart', () => {
    expect(decodeFailure(overTheWire(encodeFailure(new DevConflict())))).toBeInstanceOf(DevConflict)
    expect(decodeFailure(overTheWire(encodeFailure(new Unexpected())))).toBeInstanceOf(Unexpected)
  })

  it.each([
    ['a tag the union does not know', { _tag: 'TileMissing', kind: 'NotFound' }],
    ['a known tag with another kind', { _tag: 'DevConflict', kind: 'Forbidden' }],
    ['an Invalid without its fields', { _tag: 'DevInvalid', kind: 'Invalid' }],
    ['no failure at all', 'Server Fn Error!'],
  ])('is Unexpected when it is %s', (_, encoded) => {
    expect(decodeFailure(encoded)).toBeInstanceOf(Unexpected)
  })
})
