import { describe, expect, it } from 'vitest'

import { errorMessages } from './errors'

describe('errorMessages', () => {
  it('shows a message a validator returned', () => {
    expect(errorMessages(['Required'])).toEqual(['Required'])
  })

  it('shows the message of a Standard Schema issue', () => {
    expect(errorMessages([{ message: 'Too long', path: ['preview'] }])).toEqual(['Too long'])
  })

  it('shows nothing for an error that carries no message', () => {
    expect(errorMessages([undefined, '', 42, { code: 'x' }, { message: 42 }])).toEqual([])
  })
})
