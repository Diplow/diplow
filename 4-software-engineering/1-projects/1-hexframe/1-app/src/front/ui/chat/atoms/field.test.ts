// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'

import { inField } from './field'

// Where a click the list reads as outside it landed, on a field laid out as the Composer's: a textarea
// in a wrapper, the list's anchor.

describe('a click outside the list', () => {
  const field = document.createElement('div')
  const textarea = field.appendChild(document.createElement('textarea'))
  const elsewhere = document.createElement('button')

  it('lands in the field when it lands on it or inside it', () => {
    expect(inField(field, textarea)).toBe(true)
    expect(inField(field, field)).toBe(true)
  })

  it('lands away from it anywhere else, or with no field or no target', () => {
    expect(inField(field, elsewhere)).toBe(false)
    expect(inField(null, textarea)).toBe(false)
    expect(inField(field, null)).toBe(false)
  })
})
