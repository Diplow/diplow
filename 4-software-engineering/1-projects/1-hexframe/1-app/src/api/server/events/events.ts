// The Turn's events, `/assistant/events`: the second door of a Turn's sandbox (src/api/CLAUDE.md),
// where its launcher posts each line of what its agent says, one request a line, then one once the
// agent exited. It proves the Turn's Key from `Authorization: Bearer` before it reads the body, never
// from a cookie, so it needs no CSRF check; takes the Account and the Turn from that Key, never from
// the line; and hands the line to its program (../../assistant/programs.ts), which has Assistant
// decode it by its schema and follow it.
import { turnOnly } from '#/domains/iam/iam'

import { turnEvent } from '../../assistant/programs'
import { bearerOnly, noSession, provenKey, run, waitUntilOf, type StartContext } from '../run'

/** The most characters a line holds: what an agent says in one event, its tools' inputs included. */
const longestLine = 1024 * 1024

/** An answer with nothing to say but its status. */
const status = (code: number) => new Response(null, { status: code })

/**
 * Serves one line of a Turn's agent: proves the Turn's Key from the header alone and answers a request
 * it proves no Turn for, 401, before reading its body, or 500 when the Key could not be checked; then
 * refuses a line past the longest, 413, and one no schema reads as an event, 400; and answers 204 once
 * the line is followed, the Turn's Key revoked if it ended the Turn.
 */
export async function serveTurnEvent(request: Request): Promise<Response> {
  const exchange = bearerOnly(request)
  const context: StartContext = {
    requestId: crypto.randomUUID(),
    scope: 'assistant/events',
    waitUntil: waitUntilOf(request),
    exchange,
    session: noSession,
    key: await provenKey(exchange),
  }
  const proof = await run(context, turnOnly)
  if (!proof.ok) return status(proof.failure.kind === 'Unauthenticated' ? 401 : 500)
  const line = await request.text()
  if (line.length > longestLine) return status(413)
  const outcome = await run(context, turnEvent(line))
  if (!outcome.ok) return status(outcome.failure.kind === 'Unauthenticated' ? 401 : 500)
  return status(outcome.value === 'Malformed' ? 400 : 204)
}

/** Anything but POST: the door takes a line, and nothing else is served. */
export const methodNotAllowed = () =>
  new Response(null, { status: 405, headers: { allow: 'POST' } })
