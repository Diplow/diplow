// What a model call used, read from its answer as it is relayed: from the stream's `message_start`
// and `message_delta` events, or from a plain JSON answer's `usage`. The answer goes on chunk by
// chunk, as it comes; reading it never holds it back. Anthropic's wire format, so it stays here.
import { Option, Schema } from 'effect'

/** The tokens a call used, by how they are priced. */
export interface Usage {
  /** Input tokens read from no cache and written to none. */
  readonly input: number
  readonly output: number
  /** Input tokens written to the cache for five minutes, then for an hour. */
  readonly cacheWrite5m: number
  readonly cacheWrite1h: number
  /** Input tokens read from the cache. */
  readonly cacheRead: number
}

const Count = Schema.optionalKey(Schema.Number)

/** The usage fields of an answer, each absent when the answer does not say it. */
const UsageFields = Schema.Struct({
  input_tokens: Count,
  output_tokens: Count,
  cache_creation_input_tokens: Count,
  cache_read_input_tokens: Count,
  cache_creation: Schema.optionalKey(
    Schema.Struct({ ephemeral_5m_input_tokens: Count, ephemeral_1h_input_tokens: Count }),
  ),
})

type UsageFields = typeof UsageFields.Type

/** Where the stream's events say their usage: in its message as it starts, then on each delta. */
const Event = Schema.Union([
  Schema.Struct({
    type: Schema.Literal('message_start'),
    message: Schema.Struct({ usage: UsageFields }),
  }),
  Schema.Struct({ type: Schema.Literal('message_delta'), usage: UsageFields }),
])

/** A plain answer: its usage, when it is a message. */
const Answer = Schema.Struct({ usage: UsageFields })

const eventOf = Schema.decodeUnknownOption(Schema.fromJsonString(Event))
const answerOf = Schema.decodeUnknownOption(Schema.fromJsonString(Answer))

/**
 * The usage the answer said so far, every field it said overriding the one before: a delta's counts
 * are cumulative.
 */
function merged(seen: UsageFields | undefined, said: UsageFields): UsageFields {
  return { ...seen, ...said }
}

function usageOf(fields: UsageFields | undefined): Usage | undefined {
  if (fields === undefined) return undefined
  const written = fields.cache_creation_input_tokens ?? 0
  const split = fields.cache_creation
  return {
    input: fields.input_tokens ?? 0,
    output: fields.output_tokens ?? 0,
    // Without the split, a write is a five-minute one, the cache's default.
    cacheWrite5m: split?.ephemeral_5m_input_tokens ?? (split === undefined ? written : 0),
    cacheWrite1h: split?.ephemeral_1h_input_tokens ?? 0,
    cacheRead: fields.cache_read_input_tokens ?? 0,
  }
}

/** Reads a stream's events as they pass, line by line, and keeps the usage they say. */
function streamReader() {
  const decoder = new TextDecoder()
  let pending = ''
  let seen: UsageFields | undefined
  const line = (text: string) => {
    if (!text.startsWith('data:')) return
    const event = eventOf(text.slice('data:'.length).trim())
    if (Option.isNone(event)) return
    const said =
      event.value.type === 'message_start' ? event.value.message.usage : event.value.usage
    seen = merged(seen, said)
  }
  return {
    chunk: (bytes: Uint8Array) => {
      pending += decoder.decode(bytes, { stream: true })
      const lines = pending.split('\n')
      pending = lines.pop() ?? ''
      lines.forEach(line)
    },
    end: () => {
      line(pending + decoder.decode())
      return usageOf(seen)
    },
  }
}

/** Reads a plain answer whole as it passes, then its usage. */
function answerReader() {
  const decoder = new TextDecoder()
  let text = ''
  return {
    chunk: (bytes: Uint8Array) => {
      text += decoder.decode(bytes, { stream: true })
    },
    end: () => usageOf(Option.getOrUndefined(answerOf(text + decoder.decode()))?.usage),
  }
}

/**
 * The stream relayed as it comes, one chunk read upstream for each the reader asks for, each read by
 * `reader` on its way; `settled` once it ended, failed or was cancelled, then never again.
 */
function watched(
  source: ReadableStream<Uint8Array>,
  reader: { chunk: (bytes: Uint8Array) => void; end: () => Usage | undefined },
  settled: (usage: Usage | undefined) => void,
): ReadableStream<Uint8Array> {
  const upstream = source.getReader()
  let done = false
  const finish = () => {
    if (done) return
    done = true
    settled(reader.end())
  }
  return new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        try {
          const read = await upstream.read()
          if (read.done) {
            finish()
            controller.close()
            return
          }
          reader.chunk(read.value)
          controller.enqueue(read.value)
        } catch (error) {
          finish()
          controller.error(error)
        }
      },
      async cancel(reason) {
        // The reader went away, a Turn stopped: what was used so far is still used.
        finish()
        await upstream.cancel(reason)
      },
    },
    { highWaterMark: 0 },
  )
}

/**
 * An answer's body as it is relayed, and what the call used, once the body has ended: none for an
 * answer that failed, or that says no usage, such as a count of tokens.
 */
export function metered(answer: Response): {
  readonly body: ReadableStream<Uint8Array> | null
  readonly usage: Promise<Usage | undefined>
} {
  const type = answer.headers.get('content-type') ?? ''
  if (!answer.ok || answer.body === null) {
    return { body: answer.body, usage: Promise.resolve(undefined) }
  }
  const reader = type.includes('text/event-stream') ? streamReader() : answerReader()
  let settle: (usage: Usage | undefined) => void = () => undefined
  const usage = new Promise<Usage | undefined>((resolve) => {
    settle = resolve
  })
  return { body: watched(answer.body, reader, settle), usage }
}
