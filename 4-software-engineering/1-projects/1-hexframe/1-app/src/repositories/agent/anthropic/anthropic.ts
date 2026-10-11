// The model relay: a Turn's agent calls Anthropic through the app's proxy, and this repository makes
// the call, with plain `fetch` and no SDK, adding the platform's key, which never leaves the app's
// process. It relays what it is given and the answer as it comes, chunk by chunk, and reads what the
// call used on the way (./usage.ts). It knows no limit: Assistant decides whether a Turn may spend
// before it asks, and prices what it used. Under the tests, and `pnpm dev` without
// `ANTHROPIC_API_KEY`, the upstream is a fake (./fake.ts).
import { Config, Context, Effect, Layer, Redacted } from 'effect'

import { metered, type Usage } from './usage'

/** The endpoints a Turn's agent may call: a message, and a count of a message's tokens. */
export type Endpoint = 'messages' | 'count_tokens'

/** A call to relay: its endpoint, the headers Anthropic reads as they came, and its body, decoded. */
export interface ModelCall {
  readonly endpoint: Endpoint
  /** `anthropic-version`, passed on unchanged. */
  readonly version: string | undefined
  /** `anthropic-beta`, passed on unchanged. */
  readonly betas: string | undefined
  readonly body: unknown
}

/** Anthropic's answer, relayed: its status, the headers worth passing back, and its body as it comes. */
export interface Relayed {
  readonly status: number
  readonly headers: Headers
  readonly body: ReadableStream<Uint8Array> | null
  /** What the call used, once its body has ended, or been cancelled; none when it says none. */
  readonly usage: Effect.Effect<Usage | undefined>
}

export class Anthropic extends Context.Service<
  Anthropic,
  {
    /** Makes the call with the platform's key, and answers Anthropic's answer as it comes. */
    readonly relay: (call: ModelCall) => Effect.Effect<Relayed>
  }
>()('hexframe/Anthropic') {}

/** Where a call goes, as `fetch` makes it. */
export type Upstream = (request: Request) => Promise<Response>

const paths: Record<Endpoint, string> = {
  messages: '/v1/messages',
  count_tokens: '/v1/messages/count_tokens',
}

/** The headers of Anthropic's answer the agent may read: its type, its request id, when to retry. */
const answered = ['content-type', 'request-id', 'retry-after']

/** The call's headers: the platform's key and what Anthropic reads, nothing of the agent's request. */
function headersOf(call: ModelCall, apiKey: string): Headers {
  const headers = new Headers({ 'content-type': 'application/json', 'x-api-key': apiKey })
  if (call.version !== undefined) headers.set('anthropic-version', call.version)
  if (call.betas !== undefined) headers.set('anthropic-beta', call.betas)
  return headers
}

/**
 * The relay over an upstream, `https://api.anthropic.com` reached by `fetch` when deployed, with the
 * platform's key. Without a key, a call is a defect: the app runs, and no Turn's model answers.
 */
export function makeAnthropic(options: {
  readonly apiKey: Redacted.Redacted
  readonly upstream: Upstream
  readonly origin: string
}): Anthropic['Service'] {
  return {
    relay: (call) =>
      Effect.gen(function* () {
        const apiKey = Redacted.value(options.apiKey)
        if (apiKey === '') {
          return yield* Effect.die(
            new Error('The model relay is not configured: ANTHROPIC_API_KEY'),
          )
        }
        const request = new Request(new URL(paths[call.endpoint], options.origin), {
          method: 'POST',
          headers: headersOf(call, apiKey),
          body: JSON.stringify(call.body),
        })
        // Anthropic unreachable is a defect, as the database down is.
        const answer = yield* Effect.orDie(Effect.tryPromise(() => options.upstream(request)))
        const { body, usage } = metered(answer)
        const headers = new Headers()
        for (const name of answered) {
          const value = answer.headers.get(name)
          if (value !== null) headers.set(name, value)
        }
        return { status: answer.status, headers, body, usage: Effect.promise(() => usage) }
      }),
  }
}

/** Whether the platform's key is set: what `src/api/server/run.ts` picks the relay by. */
export const hasKey = (env: Readonly<Record<string, string | undefined>>) =>
  (env.ANTHROPIC_API_KEY ?? '') !== ''

/** The relay to Anthropic, its key from `ANTHROPIC_API_KEY`, a server-only variable. */
export const layer = Layer.effect(Anthropic)(
  Effect.gen(function* () {
    const apiKey = yield* Config.withDefault(
      Config.Redacted('ANTHROPIC_API_KEY'),
      Redacted.make(''),
    )
    return makeAnthropic({
      apiKey,
      upstream: (request) => fetch(request),
      origin: 'https://api.anthropic.com',
    })
  }).pipe(Effect.orDie),
)
