// The channel table: where a failure shows, picked by its kind and by the call that met it, never by a
// component's author. Pure; src/api/client/ carries each channel out.
import type { Kind } from '#/domains/kind'

/**
 * The call a failure comes back from: a `read` a page shows, a `frame` read (one that frames every
 * page, such as the header's), a `write`, or a `submit`, the write of a form's submit.
 */
export type Call = 'read' | 'frame' | 'write' | 'submit'

/**
 * Where a failure goes: one redirect to sign-in; the `Forbidden` state or the `ErrorState` in the
 * nearest boundary; a report with nothing on screen; the form's fields; one toast. `report` has nothing
 * to carry out in the client: the server reported every failure it sent, and the client reports, whatever
 * the channel, only a call that never reached the server (../client/channels.ts, `raise`).
 */
export type Channel = 'sign-in' | 'forbidden' | 'error-state' | 'report' | 'fields' | 'toast'

interface Row {
  calls: readonly Call[] | 'any'
  kinds: readonly Kind[] | 'any'
  channel: Channel
}

/** The table in src/api/CLAUDE.md, row for row: the first row that matches wins. */
const table: readonly Row[] = [
  { calls: 'any', kinds: ['Unauthenticated'], channel: 'sign-in' },
  { calls: ['read'], kinds: ['Forbidden'], channel: 'forbidden' },
  { calls: ['read'], kinds: 'any', channel: 'error-state' },
  { calls: ['frame'], kinds: 'any', channel: 'report' },
  { calls: ['submit'], kinds: ['Invalid'], channel: 'fields' },
  { calls: ['write', 'submit'], kinds: 'any', channel: 'toast' },
]

const matches = <T>(allowed: readonly T[] | 'any', value: T) =>
  allowed === 'any' || allowed.includes(value)

/** Where a failure of this kind, met by this call, shows. */
export function channelFor(call: Call, kind: Kind): Channel {
  const row = table.find((row) => matches(row.calls, call) && matches(row.kinds, kind))
  // Every call has a row whose kinds are 'any'; the fallback only satisfies the type.
  return row?.channel ?? 'report'
}
