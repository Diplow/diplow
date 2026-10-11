// The model proxy, `/assistant/anthropic`: the base URL a Turn's agent, Claude Code in its sandbox,
// calls Anthropic through, one of the two doors of a Turn's sandbox (src/api/CLAUDE.md). It proves
// the Turn's Key from `Authorization: Bearer` before it reads the body, never from a cookie, so it
// needs no CSRF check; serves the messages endpoint alone, and the count of its tokens; and hands the
// call to its program (../../assistant/programs.ts), which has Assistant decide whether the Turn may
// spend and relay it. Every refusal is answered as Anthropic answers one, so Claude Code stops.
import type { Effect } from 'effect'

import { type AskedCall, largestCall } from '#/domains/assistant/assistant'
import { turnOnly } from '#/domains/iam/iam'

import { modelCall } from '../../assistant/programs'
import {
  bearerOnly,
  bodyOf,
  noSession,
  provenKey,
  run,
  waitUntilOf,
  type StartContext,
} from '../run'

/** The paths it serves, from its base URL, and the endpoint each is. */
const endpoints: ReadonlyMap<string, AskedCall['endpoint']> = new Map([
  ['/v1/messages', 'messages'],
  ['/v1/messages/count_tokens', 'count_tokens'],
])

/** Anthropic's error types, by the status each is answered with. */
type ErrorType =
  | 'invalid_request_error'
  | 'authentication_error'
  | 'billing_error'
  | 'not_found_error'
  | 'request_too_large'
  | 'rate_limit_error'
  | 'api_error'

const statuses: Record<ErrorType, number> = {
  invalid_request_error: 400,
  authentication_error: 401,
  billing_error: 402,
  not_found_error: 404,
  request_too_large: 413,
  rate_limit_error: 429,
  api_error: 500,
}

/** A refusal, as Anthropic words one: its status, and `{ type: 'error', error: { type, message } }`. */
function refusal(
  type: ErrorType,
  message: string,
  requestId?: string,
  headers: Record<string, string> = {},
): Response {
  return Response.json(
    { type: 'error', error: { type, message } },
    {
      status: statuses[type],
      headers: { ...headers, ...(requestId !== undefined && { 'request-id': requestId }) },
    },
  )
}

/** A call past the largest the proxy takes, refused as Anthropic refuses one. */
const tooLarge = (requestId: string) =>
  refusal('request_too_large', 'The call is larger than the proxy takes.', requestId)

/** What each limit says to the agent, whose Turn it ended. */
const limits = {
  ceiling: 'This Turn reached its ceiling: it spent what one Turn may.',
  allowance: "The Account's allowance for the month is spent.",
} as const

/** What became of a call: refused as Anthropic would refuse it, or relayed. */
type Answer = Effect.Success<ReturnType<typeof modelCall>>

/** The answer to a call Assistant ruled on: refused as Anthropic would, or Anthropic's own. */
function answerOf(answer: Answer, requestId: string): Response {
  switch (answer._tag) {
    case 'Refused':
      return answer.why === 'too-large'
        ? tooLarge(requestId)
        : refusal(
            'invalid_request_error',
            `The proxy refused the call: ${answer.message}`,
            requestId,
          )
    case 'Limited':
      return refusal('billing_error', limits[answer.limit], requestId)
    case 'Busy':
      return refusal(
        'rate_limit_error',
        'The calls under way may spend what is left: try again once they end.',
        requestId,
        { 'retry-after': '2' },
      )
    case 'TurnOver':
      return refusal('authentication_error', 'This Turn has ended.', requestId)
    case 'Relayed': {
      const { status, headers, body } = answer.relayed
      return new Response(body, { status, headers })
    }
  }
}

/**
 * Serves one call of a Turn's agent, `path` the part of its URL after the base: proves the Turn's Key
 * from the header alone and answers a request it proves no Turn for before reading its body; then
 * refuses any path but the messages endpoint's, reads the body no further than the largest call,
 * refusing one past it or cut off on the way, and answers what its program decided.
 */
export async function serveModelCall(request: Request, path: string): Promise<Response> {
  const exchange = bearerOnly(request)
  const context: StartContext = {
    requestId: crypto.randomUUID(),
    scope: 'assistant/anthropic',
    waitUntil: waitUntilOf(request),
    exchange,
    session: noSession,
    key: await provenKey(exchange),
  }
  const { requestId } = context
  const proof = await run(context, turnOnly)
  if (!proof.ok) {
    return proof.failure.kind === 'Unauthenticated'
      ? refusal('authentication_error', 'No Turn of the Assistant proves this call.', requestId)
      : refusal('api_error', 'The call could not be checked.', requestId)
  }
  const endpoint = endpoints.get(path)
  if (endpoint === undefined) {
    return refusal('not_found_error', 'The proxy serves the messages endpoint alone.', requestId)
  }
  const body = await bodyOf(request, largestCall)
  if (body._tag === 'TooLarge') return tooLarge(requestId)
  if (body._tag === 'Broken') {
    return refusal('invalid_request_error', 'The call was cut off on the way.', requestId)
  }
  const outcome = await run(
    context,
    modelCall({
      endpoint,
      version: request.headers.get('anthropic-version') ?? undefined,
      betas: request.headers.get('anthropic-beta') ?? undefined,
      body: body.text,
    }),
  )
  if (!outcome.ok) return refusal('api_error', 'The call failed on the way.', requestId)
  return answerOf(outcome.value, requestId)
}

/** Anything but POST: the messages endpoint takes a call, and nothing else is served. */
export const methodNotAllowed = () =>
  Response.json(
    { type: 'error', error: { type: 'invalid_request_error', message: 'POST only.' } },
    { status: 405, headers: { allow: 'POST' } },
  )
