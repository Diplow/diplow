// What a Turn's agent says as it runs, as Assistant reads it: Claude Code's `stream-json`, one event a
// line, which the Turn's launcher posts as it comes, then one line of its own once the agent exited.
// Each line is decoded by a schema that names only what Assistant keeps of it: the agent's text, the
// tool it runs now, how it ended. Every other event, and every other field, is the agent's own and
// left out. The schema speaks Claude Code's words, as `../spending/call.ts` speaks Anthropic's: it is
// a rule on what Claude Code writes, read as it comes. Pure.
import { Option, Schema } from 'effect'

import { stepOf, type TurnEnd, type TurnStep } from '../entities'

/** A block of an agent's message: its text, a tool it runs, or anything else, left out. */
const Block = Schema.Union([
  Schema.Struct({ type: Schema.Literal('text'), text: Schema.String }),
  Schema.Struct({
    type: Schema.Literal('tool_use'),
    name: Schema.String,
    input: Schema.Record(Schema.String, Schema.Unknown),
  }),
  Schema.Struct({ type: Schema.String }),
])

/** A line of the stream: an agent's message, its result, the launcher's word that it exited, or else. */
const Line = Schema.Union([
  Schema.Struct({
    type: Schema.Literal('assistant'),
    message: Schema.Struct({ content: Schema.Array(Block) }),
  }),
  Schema.Struct({ type: Schema.Literal('result'), subtype: Schema.String }),
  Schema.Struct({ type: Schema.Literal('hexframe_exit') }),
  Schema.Struct({ type: Schema.String }),
])

const decodeLine = Schema.decodeUnknownOption(Schema.fromJsonString(Line))

/**
 * What Assistant keeps of a line: the agent said something, which the timeline keeps as its Message;
 * it runs a tool, its step now; it finished, by its result; or it exited, the stream over, whatever it
 * said before.
 */
export type AgentEvent =
  | { readonly _tag: 'Said'; readonly text: string }
  | { readonly _tag: 'Stepping'; readonly step: TurnStep }
  | { readonly _tag: 'Finished'; readonly how: TurnEnd }
  | { readonly _tag: 'Exited' }

/**
 * How a result ends a Turn: by its answer when it succeeded, by its ceiling when it spent its budget,
 * the second fence Claude Code holds itself to, and by its sandbox otherwise.
 */
const endOf = (subtype: string): TurnEnd => {
  if (subtype === 'success') return 'answered'
  return subtype === 'error_max_budget_usd' ? 'ceiling' : 'sandbox'
}

/** The input fields that say what a tool works on, the first one given told. */
const subjects = ['command', 'file_path', 'path', 'pattern', 'url', 'id', 'title', 'query']

/**
 * A tool's step: its name, an MCP tool's without the server's prefix (`mcp__hexframe__open_tile` reads
 * `open_tile`), and the first of its input's subjects given as text.
 */
function stepFor(name: string, input: Readonly<Record<string, unknown>>): TurnStep {
  const tool = name.startsWith('mcp__') ? name.split('__').slice(2).join('__') : name
  const detail = subjects.map((field) => input[field]).find((value) => typeof value === 'string')
  return stepOf(tool, typeof detail === 'string' ? detail.replace(/\s+/g, ' ').trim() : undefined)
}

/** What a message of the agent's says: its text, every text block joined, then its last tool. */
function eventsOf(content: ReadonlyArray<typeof Block.Type>): ReadonlyArray<AgentEvent> {
  const text = content
    .flatMap((block) => ('text' in block ? [block.text] : []))
    .join('\n\n')
    .trim()
  const tool = content.findLast((block) => 'name' in block)
  return [
    ...(text === '' ? [] : [{ _tag: 'Said', text } as const]),
    ...(tool === undefined || !('name' in tool)
      ? []
      : [{ _tag: 'Stepping', step: stepFor(tool.name, tool.input) } as const]),
  ]
}

/**
 * What Assistant keeps of one line of the agent's stream, in order, nothing for an event it leaves
 * out; none for a line that is no event, which is no JSON or names no type.
 */
export function readLine(line: string): ReadonlyArray<AgentEvent> | undefined {
  const decoded = decodeLine(line)
  if (Option.isNone(decoded)) return undefined
  const event = decoded.value
  if ('message' in event) return eventsOf(event.message.content)
  if ('subtype' in event) return [{ _tag: 'Finished', how: endOf(event.subtype) }]
  return event.type === 'hexframe_exit' ? [{ _tag: 'Exited' }] : []
}
