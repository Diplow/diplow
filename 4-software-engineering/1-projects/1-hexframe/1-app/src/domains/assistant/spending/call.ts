// A model call a Turn's agent makes through the app's proxy, as Assistant lets it through: its body
// decoded by a strict schema that keeps no field the settings don't name, for the models they name,
// with client tools alone, `max_tokens` capped; and its betas, each one the settings name. What a
// message holds the model reads, never the app: its content blocks are checked by their type alone, so
// no server tool's block slips in. Pure.
import { Result, Schema } from 'effect'

import { settings } from '../settings'

/** A model the settings name. */
export type Model = keyof typeof settings.model.prices

/** Each model the settings name, as a schema reads it. */
const models = Object.keys(settings.model.prices) as ReadonlyArray<Model>

/** An object whose `type` is one of `types`, its other fields kept as they came. */
const typed = <const T extends ReadonlyArray<string>>(types: T) =>
  Schema.StructWithRest(Schema.Struct({ type: Schema.Literals(types) }), [
    Schema.Record(Schema.String, Schema.Unknown),
  ])

/**
 * What a message's content may hold: what the user, the agent and its client tools say. No server
 * tool's use or result, no MCP connector's, no container's upload.
 */
const Block = typed([
  'text',
  'image',
  'document',
  'tool_use',
  'tool_result',
  'thinking',
  'redacted_thinking',
])

/** A message: who says it, the user, the agent or the operator mid-conversation, and what. */
const Message = Schema.StructWithRest(
  Schema.Struct({
    role: Schema.Literals(['user', 'assistant', 'system']),
    content: Schema.Union([Schema.String, Schema.Array(Block)]),
  }),
  [Schema.Record(Schema.String, Schema.Unknown)],
)

/** A client tool, run by the agent itself: never a server tool, which has a `type` of its own. */
const Tool = Schema.Struct({
  type: Schema.optionalKey(Schema.Literal('custom')),
  name: Schema.String,
  description: Schema.optionalKey(Schema.String),
  input_schema: Schema.Record(Schema.String, Schema.Unknown),
  cache_control: Schema.optionalKey(Schema.Record(Schema.String, Schema.Unknown)),
  strict: Schema.optionalKey(Schema.Boolean),
  eager_input_streaming: Schema.optionalKey(Schema.Boolean),
})

/** The settings' fields, each with its shape: the schema can hold no field they don't name. */
type Field = (typeof settings.model.fields)[number]

const fields = {
  model: Schema.Literals(models),
  messages: Schema.Array(Message),
  system: Schema.optionalKey(Schema.Union([Schema.String, Schema.Array(typed(['text']))])),
  tools: Schema.optionalKey(Schema.Array(Tool)),
  tool_choice: Schema.optionalKey(
    Schema.Struct({
      type: Schema.Literals(['auto', 'none', 'any', 'tool']),
      name: Schema.optionalKey(Schema.String),
      disable_parallel_tool_use: Schema.optionalKey(Schema.Boolean),
    }),
  ),
  max_tokens: Schema.optionalKey(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))),
  metadata: Schema.optionalKey(Schema.Struct({ user_id: Schema.optionalKey(Schema.String) })),
  stream: Schema.optionalKey(Schema.Boolean),
  temperature: Schema.optionalKey(Schema.Number),
  stop_sequences: Schema.optionalKey(Schema.Array(Schema.String)),
  thinking: Schema.optionalKey(
    Schema.Struct({
      type: Schema.Literals(['adaptive', 'enabled', 'disabled', 'between_tools']),
      budget_tokens: Schema.optionalKey(Schema.Int),
      display: Schema.optionalKey(Schema.String),
    }),
  ),
  output_config: Schema.optionalKey(
    Schema.Struct({
      effort: Schema.optionalKey(Schema.Literals(['low', 'medium', 'high', 'xhigh', 'max'])),
      format: Schema.optionalKey(Schema.Record(Schema.String, Schema.Unknown)),
      task_budget: Schema.optionalKey(Schema.Record(Schema.String, Schema.Unknown)),
    }),
  ),
  context_management: Schema.optionalKey(Schema.Record(Schema.String, Schema.Unknown)),
} satisfies Record<Field, Schema.Top>

/** A call's body, as the proxy lets it through. */
const Body = Schema.Struct(fields)

export type CallBody = typeof Body.Type

/** Decodes a body's text, refusing any field, at any depth, its schema does not name. */
const decodeBody = Schema.decodeUnknownResult(Schema.fromJsonString(Body), {
  onExcessProperty: 'error',
})

/** A call let through: its body, `max_tokens` capped, and the model it asks for. */
export interface Allowed {
  readonly body: CallBody
  readonly model: Model
}

/** Why a call is refused: a body past the largest, or one the schema or the betas refuse. */
export type CallRefused =
  | { readonly why: 'too-large' }
  | { readonly why: 'invalid'; readonly message: string }

/** The betas `anthropic-beta` names, each trimmed, the empty ones dropped. */
const betasOf = (header: string | undefined) =>
  (header ?? '')
    .split(',')
    .map((beta) => beta.trim())
    .filter((beta) => beta !== '')

/**
 * A call, its body's text and its `anthropic-beta`, as the proxy lets it through, or why it is
 * refused: a body past the largest, a field, a model, a tool or a content block the schema does not
 * name, or a beta the settings do not.
 */
export function allowedCall(text: string, betas: string | undefined): Result.Result<Allowed, CallRefused> {
  if (text.length > settings.model.largestCall) return Result.fail({ why: 'too-large' })
  const unnamed = betasOf(betas).filter(
    (beta) => !(settings.model.betas as ReadonlyArray<string>).includes(beta),
  )
  if (unnamed.length > 0) {
    return Result.fail({ why: 'invalid', message: `Unnamed betas: ${unnamed.join(', ')}` })
  }
  const decoded = decodeBody(text)
  if (Result.isFailure(decoded)) {
    return Result.fail({ why: 'invalid', message: decoded.failure.message })
  }
  const body = decoded.success
  const capped =
    body.max_tokens === undefined
      ? body
      : { ...body, max_tokens: Math.min(body.max_tokens, settings.model.maxTokens) }
  return Result.succeed({ body: capped, model: body.model })
}
