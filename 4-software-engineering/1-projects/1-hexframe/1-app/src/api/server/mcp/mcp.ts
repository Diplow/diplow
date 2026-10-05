// The MCP endpoint, `/mcp`: the one other door into the API layer (src/api/CLAUDE.md). Stateless and
// answering JSON, on the MCP server's SDK, which this folder alone imports. It proves its Account from
// the `Authorization: Bearer` Key before it reads the body, never from a cookie, so it needs no CSRF
// check; then each tool of the table (./tools.ts) runs its program through `run`, like a server
// function, the Key in its own slot of the request's context and the Session slot empty.
import {
  McpServer,
  createMcpHandler,
  type AuthInfo,
  type CallToolResult,
  type ToolAnnotations,
} from '@modelcontextprotocol/server'
import { Schema } from 'effect'

import * as Iam from '#/domains/iam/iam'

import { decodeFailure, type EncodedFailure, type Failure } from '../../errors/failure'
import { messageFor } from '../../errors/messages'
import { noSession, provenKey, run, waitUntilOf, type StartContext } from '../run'
import { tools, type Tool } from './tools'

const implementation = { name: 'hexframe', version: '1.0.0' }

const instructions =
  "Hexframe holds the user's System: a hierarchy of Tiles, each with a Title, a Preview and a " +
  'Body, where what comes first is what matters most. The Root is the user. Read it as its ' +
  "author laid it out: open a Tile, read its Children's Previews, and open only what matters."

/** Each tool's input, as the SDK takes it: a Standard Schema that also describes itself in JSON Schema. */
const inputs = new Map(
  tools.map((tool) => [tool, Schema.toStandardJSONSchemaV1(Schema.toStandardSchemaV1(tool.input))]),
)

/** What the door passes on of a request: where it was sent and its Bearer Key; never a cookie. */
function exchangeOf(request: Request): StartContext['exchange'] {
  const headers = new Headers()
  const authorization = request.headers.get('authorization')
  if (authorization !== null) headers.set('authorization', authorization)
  return { url: request.url, headers, setCookies: () => undefined }
}

interface Refusal {
  readonly failure: EncodedFailure<Failure>
  readonly requestId: string
}

/**
 * A failure as an agent reads it: its tag, its sentence, the fields at fault for an `Invalid` one,
 * and the request id; never a stack.
 */
function sentence({ failure, requestId }: Refusal, scope: string): string {
  const decoded = decodeFailure(failure)
  const atFault = 'fields' in decoded ? ` (at fault: ${decoded.fields.join(', ')})` : ''
  return `${failure._tag}: ${messageFor(decoded, scope)}${atFault} (request ${requestId})`
}

/**
 * The answer to a request no Key proves, or whose Key could not be checked, sent before its body is
 * read: 401 for nobody signed in, 500 for anything else.
 */
function refused(refusal: Refusal): Response {
  const unauthenticated = refusal.failure.kind === 'Unauthenticated'
  const error = { code: -32001, message: sentence(refusal, 'mcp') }
  return Response.json(
    { jsonrpc: '2.0', id: null, error },
    {
      status: unauthenticated ? 401 : 500,
      headers: unauthenticated ? { 'www-authenticate': 'Bearer' } : {},
    },
  )
}

/**
 * A tool's answer: its value as JSON, `null` for a write that answers nothing, or its failure as a
 * tool error the agent reads.
 */
function resultOf(
  outcome: { ok: true; value: unknown } | ({ ok: false } & Refusal),
  scope: string,
): CallToolResult {
  if (outcome.ok) {
    return { content: [{ type: 'text', text: JSON.stringify(outcome.value ?? null) }] }
  }
  return { isError: true, content: [{ type: 'text', text: sentence(outcome, scope) }] }
}

/**
 * What a client may tell its user of a tool before calling it: whether it only reads, whether it
 * erases what the user wrote, and that it reaches nothing but the user's System.
 */
const annotationsOf = (tool: Tool): ToolAnnotations => ({
  readOnlyHint: tool.kind === 'read',
  destructiveHint: tool.destructive === true,
  openWorldHint: false,
})

/** The MCP server for one request: every tool of the table, each run for the Account its Key proved. */
function serverFor(context: StartContext) {
  const server = new McpServer(implementation, { instructions })
  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: inputs.get(tool),
        annotations: annotationsOf(tool),
      },
      async (input) =>
        resultOf(await run({ ...context, scope: tool.name }, tool.program(input)), tool.name),
    )
  }
  return server
}

/**
 * Each proven request's context, by the `authInfo` the SDK hands its factory back untouched (it
 * rebuilds the request itself on the 2025 protocol's path, so the request cannot be the key).
 */
const proven = new WeakMap<AuthInfo, StartContext>()

/** The SDK's handler, stateless and answering JSON: one MCP server per request, built for its Key. */
const handler = createMcpHandler(
  ({ authInfo }) => {
    const context = authInfo === undefined ? undefined : proven.get(authInfo)
    if (context === undefined) throw new Error('An MCP request reached its server unproven')
    return serverFor(context)
  },
  { responseMode: 'json' },
)

/**
 * Serves one MCP request: proves its Key first, from the header alone, and answers a request it
 * proves nothing for before reading its body; then hands the request to the SDK.
 */
export async function serveMcp(request: Request): Promise<Response> {
  const exchange = exchangeOf(request)
  const context: StartContext = {
    requestId: crypto.randomUUID(),
    scope: 'mcp',
    waitUntil: waitUntilOf(request),
    exchange,
    session: noSession,
    key: await provenKey(exchange),
  }
  const proof = await run(context, Iam.signedIn)
  if (!proof.ok) return refused(proof)
  // The SDK checks no token of its own: the Key was proven above, and its secret goes no further.
  const authInfo: AuthInfo = { token: '', clientId: 'hexframe', scopes: [] }
  proven.set(authInfo, context)
  return handler.fetch(request, { authInfo })
}

/** GET and DELETE: a stateless endpoint has no stream to open and no session to end. */
export const methodNotAllowed = () =>
  new Response(null, { status: 405, headers: { allow: 'POST' } })
