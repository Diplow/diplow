import { describe, expect, it } from 'vitest'

import { kinds, type Kind } from '#/domains/kind'

import { channelFor, type Call, type Channel } from './channel'

const calls: readonly Call[] = ['read', 'frame', 'write', 'submit']

// The table in src/api/CLAUDE.md, written out for every call and kind.
const expected: Record<Call, Record<Kind, Channel>> = {
  read: {
    Unauthenticated: 'sign-in',
    Forbidden: 'forbidden',
    Invalid: 'error-state',
    NotFound: 'error-state',
    Conflict: 'error-state',
    Unexpected: 'error-state',
  },
  frame: {
    Unauthenticated: 'sign-in',
    Forbidden: 'report',
    Invalid: 'report',
    NotFound: 'report',
    Conflict: 'report',
    Unexpected: 'report',
  },
  write: {
    Unauthenticated: 'sign-in',
    Forbidden: 'toast',
    Invalid: 'toast',
    NotFound: 'toast',
    Conflict: 'toast',
    Unexpected: 'toast',
  },
  submit: {
    Unauthenticated: 'sign-in',
    Forbidden: 'toast',
    Invalid: 'fields',
    NotFound: 'toast',
    Conflict: 'toast',
    Unexpected: 'toast',
  },
}

describe('the channel table', () => {
  it.each(calls.flatMap((call) => kinds.map((kind) => [call, kind] as const)))(
    'sends a %s failing with %s where src/api/CLAUDE.md says',
    (call, kind) => {
      expect(channelFor(call, kind)).toBe(expected[call][kind])
    },
  )
})
