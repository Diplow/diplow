// A model call a Turn's agent makes through the app's proxy, as Assistant lets it through: its body
// decoded by a strict schema that keeps no field the settings don't name, for the models they name,
// with client tools alone, `max_tokens` capped; and its betas, each one the settings name. Every
// object Anthropic gives a shape has it here, but three, passed through on purpose since the model
// reads them, never the app: a content block's fields past its type and, for an image or a document,
// its source, held inline so Anthropic fetches nothing for the model and a call costs no more than its
// body's length says; a JSON Schema, a tool's input or an answer's format; and an edit of the
// context's parameters, past its type. No server tool's block slips in. Pure.
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

/** An object whose `type` is `type` and whose `source` is one of `sources`, its other fields kept. */
const sourced = <const T extends string>(type: T, sources: ReadonlyArray<string>) =>
  Schema.StructWithRest(Schema.Struct({ type: Schema.Literal(type), source: typed(sources) }), [
    Schema.Record(Schema.String, Schema.Unknown),
  ])

/**
 * An image or a document held in the call itself: an image in base64, a document in base64 or as
 * text. Never one at a URL or among the stored files, which Anthropic would fetch for the model, at a
 * cost the body's length does not bound.
 */
const Image = sourced('image', ['base64'])
const Document = sourced('document', ['base64', 'text'])

/** What a client tool's result may hold: text, and an image or a document held inline. */
const ResultBlock = Schema.Union([typed(['text']), Image, Document])

/** A client tool's result, said by its text or by blocks its result may hold. */
const ToolResult = Schema.StructWithRest(
  Schema.Struct({
    type: Schema.Literal('tool_result'),
    content: Schema.optionalKey(Schema.Union([Schema.String, Schema.Array(ResultBlock)])),
  }),
  [Schema.Record(Schema.String, Schema.Unknown)],
)

/**
 * What a message's content may hold: what the user, the agent and its client tools say, an image or a
 * document inline. No server tool's use or result, no MCP connector's, no container's upload.
 */
const Block = Schema.Union([
  typed(['text', 'tool_use', 'thinking', 'redacted_thinking']),
  Image,
  Document,
  ToolResult,
])

/**
 * A message: who says it, the user, the agent or the operator mid-conversation, and what; nothing
 * else, as Anthropic takes it.
 */
const Message = Schema.Struct({
  role: Schema.Literals(['user', 'assistant', 'system']),
  content: Schema.Union([Schema.String, Schema.Array(Block)]),
})

/**
 * A JSON Schema, an object at its root: the model reads it, so what it holds past its `type` is
 * passed through.
 */
const JsonSchema = Schema.StructWithRest(Schema.Struct({ type: Schema.Literal('object') }), [
  Schema.Record(Schema.String, Schema.Unknown),
])

/** Where a cache breakpoint falls: how long it lasts, and its scope under `prompt-caching-scope`. */
const CacheControl = Schema.Struct({
  type: Schema.Literal('ephemeral'),
  ttl: Schema.optionalKey(Schema.Literals(['5m', '1h'])),
  scope: Schema.optionalKey(Schema.String),
})

/** A client tool, run by the agent itself: never a server tool, which has a `type` of its own. */
const Tool = Schema.Struct({
  type: Schema.optionalKey(Schema.Literal('custom')),
  name: Schema.String,
  description: Schema.optionalKey(Schema.String),
  input_schema: JsonSchema,
  cache_control: Schema.optionalKey(CacheControl),
  strict: Schema.optionalKey(Schema.Boolean),
  eager_input_streaming: Schema.optionalKey(Schema.Boolean),
})

/**
 * An edit of the context before the model reads it, under `context-management`: old tool results or
 * thinking cleared, its parameters passed through past its type.
 */
const ContextEdit = Schema.StructWithRest(
  Schema.Struct({ type: Schema.Literals(['clear_tool_uses_20250919', 'clear_thinking_20251015']) }),
  [Schema.Record(Schema.String, Schema.Unknown)],
)

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
      format: Schema.optionalKey(
        Schema.Struct({ type: Schema.Literal('json_schema'), schema: JsonSchema }),
      ),
      task_budget: Schema.optionalKey(
        Schema.Struct({
          type: Schema.Literal('tokens'),
          total: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
          remaining: Schema.optionalKey(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))),
        }),
      ),
    }),
  ),
  context_management: Schema.optionalKey(
    Schema.Struct({ edits: Schema.optionalKey(Schema.Array(ContextEdit)) }),
  ),
} satisfies Record<Field, Schema.Top>

/** A call's body, as the proxy lets it through. */
const Body = Schema.Struct(fields)

type CallBody = typeof Body.Type

/**
 * Decodes a body's text, refusing any field its schema does not name, in the body and in every object
 * its schema gives a shape: a message, a tool, a cache breakpoint, `thinking`, `output_config`,
 * `context_management`. A content block, a JSON Schema and an edit of the context keep their other
 * fields, the model's to read, once their type, and an image's or a document's source, are named.
 */
const decodeBody = Schema.decodeUnknownResult(Schema.fromJsonString(Body), {
  onExcessProperty: 'error',
})

/** `anthropic-version`, a date. */
const isVersion = (version: string) => /^\d{4}-\d{2}-\d{2}$/.test(version)

/**
 * A call let through: its body, `max_tokens` capped and a thinking budget kept below it, the model it
 * asks for, and the most tokens it may answer, none for a count of tokens.
 */
export interface Allowed {
  readonly body: CallBody
  readonly model: Model
  readonly maxTokens: number
}

/**
 * Why a call is refused: its body or its headers out of what the settings name. A body past the
 * largest call never reaches here: the proxy reads no further (`largestCall`, `../assistant.ts`).
 */
export interface CallRefused {
  readonly why: 'invalid'
  readonly message: string
}

/** The betas `anthropic-beta` names, each trimmed, the empty ones dropped. */
const betasOf = (header: string | undefined) =>
  (header ?? '')
    .split(',')
    .map((beta) => beta.trim())
    .filter((beta) => beta !== '')

/** Why a call's headers are refused, if they are: a version no date, or a beta the settings do not name. */
function headersRefused(headers: {
  readonly version: string | undefined
  readonly betas: string | undefined
}): string | undefined {
  if (headers.version !== undefined && !isVersion(headers.version)) {
    return `anthropic-version is no date: ${headers.version}`
  }
  const unnamed = betasOf(headers.betas).filter(
    (beta) => !(settings.model.betas as ReadonlyArray<string>).includes(beta),
  )
  return unnamed.length > 0 ? `Unnamed betas: ${unnamed.join(', ')}` : undefined
}

/**
 * A body with `max_tokens` capped by the settings, and a thinking budget, which must stay below it,
 * brought below the cap too.
 */
function capped(body: CallBody): CallBody {
  if (body.max_tokens === undefined) return body
  const maxTokens = Math.min(body.max_tokens, settings.model.maxTokens)
  const budget = body.thinking?.budget_tokens
  const thinking =
    body.thinking === undefined || budget === undefined || budget < maxTokens
      ? body.thinking
      : { ...body.thinking, budget_tokens: maxTokens - 1 }
  return { ...body, max_tokens: maxTokens, ...(thinking !== undefined && { thinking }) }
}

/**
 * A call, its body's text and the headers Anthropic reads, as the proxy lets it through, or why it is
 * refused: a field, a model, a tool, a content block or a source the schema does not name, a version
 * no date, or a beta the settings do not name.
 */
export function allowedCall(call: {
  readonly body: string
  readonly version: string | undefined
  readonly betas: string | undefined
}): Result.Result<Allowed, CallRefused> {
  const refused = headersRefused(call)
  if (refused !== undefined) return Result.fail({ why: 'invalid', message: refused })
  const decoded = decodeBody(call.body)
  if (Result.isFailure(decoded)) {
    return Result.fail({ why: 'invalid', message: decoded.failure.message })
  }
  const body = capped(decoded.success)
  return Result.succeed({ body, model: body.model, maxTokens: body.max_tokens ?? 0 })
}
