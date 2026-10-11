// A fake Anthropic, in this process, which every test and `pnpm dev` without `ANTHROPIC_API_KEY` call
// instead of the real one (src/api/server/run.ts): no test and no gate reaches Anthropic. It keeps
// every call it was made, and answers each by a handler a test sets, a short streamed message by
// default.
import { Layer, Redacted } from 'effect'

import { Anthropic, makeAnthropic } from './anthropic'

/** A call the fake was made, as it reached it. */
export interface FakeCall {
  readonly url: string
  readonly headers: Headers
  readonly body: unknown
}

/** A stream of Anthropic's events, each as a server-sent event. */
export function eventStream(
  events: ReadonlyArray<{ readonly type: string; readonly [field: string]: unknown }>,
): string {
  return events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join('')
}

/** A message streamed as Anthropic streams one: its text, and the tokens it says it used. */
export function streamedMessage(
  text: string,
  usage: { readonly input_tokens: number; readonly output_tokens: number },
): Response {
  const events = [
    {
      type: 'message_start',
      message: {
        id: 'msg_fake',
        type: 'message',
        role: 'assistant',
        content: [],
        model: 'fake',
        usage: { input_tokens: usage.input_tokens, output_tokens: 1 },
      },
    },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'ping' },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
    { type: 'content_block_stop', index: 0 },
    {
      type: 'message_delta',
      delta: { stop_reason: 'end_turn' },
      usage: { output_tokens: usage.output_tokens },
    },
    { type: 'message_stop' },
  ]
  return new Response(eventStream(events), {
    headers: { 'content-type': 'text/event-stream', 'request-id': 'req_fake' },
  })
}

const calls: Array<FakeCall> = []

const answering = (): Response =>
  streamedMessage('The model is a fake here: set ANTHROPIC_API_KEY to reach Anthropic.', {
    input_tokens: 10,
    output_tokens: 12,
  })

let answer: (call: FakeCall) => Response | Promise<Response> = answering

/** The fake's calls, and how it answers them. */
export const fakeAnthropic = {
  /** Every call made since the last `reset`, oldest first. */
  calls: (): ReadonlyArray<FakeCall> => calls,
  /** Answers every call from now on by `handler`. */
  answerWith: (handler: (call: FakeCall) => Response | Promise<Response>) => {
    answer = handler
  },
  /** Forgets the calls, and answers the default message again. */
  reset: () => {
    calls.length = 0
    answer = answering
  },
}

/** The relay over the fake, with a key of its own that reaches nothing. */
export const layer = Layer.succeed(
  Anthropic,
  makeAnthropic({
    apiKey: Redacted.make('fake-platform-key'),
    origin: 'https://anthropic.invalid',
    upstream: async (request) => {
      const call: FakeCall = {
        url: request.url,
        headers: request.headers,
        body: await request.json(),
      }
      calls.push(call)
      return answer(call)
    },
  }),
)
