import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { Exit, Option } from 'effect'
import { describe, expect, it } from 'vitest'

import * as Iam from '#/domains/iam/iam'

import * as Mapping from '../../mapping/programs'
import { noKey, run, type StartContext } from '../run'
import { methodNotAllowed, serveMcp } from './mcp'

// The MCP endpoint, driven by the SDK's own client over the handler, on the runtime's Better Auth and
// tiles over PGlite: an Account signs up, issues a Key, and an agent reads its System with it.

const endpoint = 'http://localhost/mcp'

let devices = 0

/** A request from a device of its own, its cookies kept as the server sets them. */
function device() {
  devices += 1
  const cookies = new Map<string, string>()
  const cookie = () => [...cookies].map(([name, value]) => `${name}=${value}`).join('; ')
  const context = (): StartContext => ({
    requestId: 'req-mcp',
    scope: 'test',
    waitUntil: () => undefined,
    exchange: {
      url: 'http://localhost/_serverFn',
      headers: new Headers({ cookie: cookie(), 'x-forwarded-for': `10.1.0.${String(devices)}` }),
      setCookies: (lines) => {
        for (const line of lines) {
          const [pair = ''] = line.split(';')
          const at = pair.indexOf('=')
          cookies.set(pair.slice(0, at).trim(), pair.slice(at + 1).trim())
        }
      },
    },
    session: Exit.succeed(Option.none()),
    key: noKey,
  })
  return { context, cookie }
}

/** The value of a call that must succeed. */
async function value<A>(outcome: Promise<{ ok: true; value: A } | { ok: false }>): Promise<A> {
  const settled = await outcome
  if (!settled.ok) throw new Error(`Expected a success, got ${JSON.stringify(settled)}`)
  return settled.value
}

/** A new Account, signed in on a device, with one Key issued, and a request its Session proves. */
async function signedUp() {
  const { context, cookie } = device()
  const credentials = { email: `${crypto.randomUUID()}@example.com`, password: 'lovelace1815' }
  await value(run(context(), Iam.signUp(credentials)))
  const session = await value(run(context(), Iam.proven))
  const signedIn: StartContext = { ...context(), session: Exit.succeed(session) }
  const { key, secret } = await value(run(signedIn, Iam.issueKey('Claude Code')))
  return { signedIn, cookie: cookie(), key, secret }
}

/** An MCP client that sends these headers to the handler, in the 2025 protocol or the newest. */
async function connect(headers: Record<string, string>, mode: 'legacy' | 'auto' = 'legacy') {
  const client = new Client({ name: 'test', version: '1.0.0' }, { versionNegotiation: { mode } })
  const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
    requestInit: { headers },
    fetch: (input, init) => serveMcp(new Request(input, init)),
  })
  await client.connect(transport)
  return client
}

const bearer = (secret: string) => ({ authorization: `Bearer ${secret}` })

/** A tool's answer: its JSON, or its error's text. */
async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args })
  const [first] = result.content as ReadonlyArray<{ type: string; text: string }>
  const text = first?.text ?? ''
  return result.isError === true ? { error: text } : { value: JSON.parse(text) as unknown }
}

const content = (title: string) => ({ title, preview: `${title}, in short.`, body: `# ${title}` })

/**
 * The Account's System: the Root, named, a Child in Direction 1 with one of its own, a Context Tile,
 * a Reference to the Child, and a broken Reference.
 */
async function aSystem(signedIn: StartContext) {
  const { id } = await value(run(signedIn, Mapping.system))
  const root = await value(run(signedIn, Mapping.editTile({ id, ...content('Ada') })))
  const create = (
    parent: string,
    slot: Parameters<typeof Mapping.createTile>[0]['slot'],
    title: string,
  ) => value(run(signedIn, Mapping.createTile({ parent, slot, ...content(title) })))
  const child = await create(root.id, 1, 'Frontend')
  const grandchild = await create(child.id, 2, 'Routes')
  const principles = await create(root.id, -1, 'Principles')
  const gone = await create(root.id, 6, 'Gone')
  await value(
    run(signedIn, Mapping.createReference({ parent: root.id, slot: -2, target: child.id })),
  )
  await value(
    run(signedIn, Mapping.createReference({ parent: root.id, slot: -3, target: gone.id })),
  )
  await value(run(signedIn, Mapping.deleteTile({ id: gone.id })))
  return { root, child, grandchild, principles, gone }
}

const glimpse = ({ id, title, preview }: { id: string; title: string; preview: string }) => ({
  _tag: 'Tile',
  id,
  title,
  preview,
})

describe('the MCP endpoint', () => {
  it.each(['legacy', 'auto'] as const)(
    'lists open_tile and map, each with its input in JSON Schema (%s protocol)',
    async (mode) => {
      const { secret } = await signedUp()
      const client = await connect(bearer(secret), mode)
      const { tools } = await client.listTools()
      expect(tools.map(({ name }) => name)).toEqual(['open_tile', 'map'])
      for (const tool of tools) {
        expect(tool.description).toMatch(/Preview/)
        expect(tool.annotations?.readOnlyHint).toBe(true)
        expect(tool.inputSchema).toMatchObject({ type: 'object' })
        expect(tool.inputSchema.required ?? []).toEqual([])
      }
      const properties = Object.values(tools[1]?.inputSchema.properties ?? {})
      expect(properties).toHaveLength(3)
      for (const property of properties) expect(property).toHaveProperty('description')
    },
  )

  it('opens the Root by default: all it says, and its neighbours by Title and Preview only', async () => {
    const { signedIn, secret } = await signedUp()
    const { root, child, principles, gone } = await aSystem(signedIn)
    const client = await connect(bearer(secret))
    const opened = await call(client, 'open_tile')
    expect(opened).toEqual({
      value: {
        tile: { _tag: 'Tile', id: root.id, ...content('Ada') },
        parent: null,
        children: { 1: glimpse(child) },
        context: {
          '-1': glimpse(principles),
          '-2': {
            _tag: 'Reference',
            tile: { id: child.id, title: 'Frontend', preview: child.preview },
          },
          '-3': { _tag: 'BrokenReference', target: gone.id },
        },
      },
    })
    expect(JSON.stringify(opened)).not.toContain(child.body)
  })

  it('opens a Tile with the fields asked, and names its parent', async () => {
    const { signedIn, secret } = await signedUp()
    const { root, child, grandchild } = await aSystem(signedIn)
    const client = await connect(bearer(secret))
    expect(await call(client, 'open_tile', { id: child.id, fields: ['title'] })).toEqual({
      value: {
        tile: { _tag: 'Tile', id: child.id, title: 'Frontend' },
        parent: { id: root.id, title: 'Ada' },
        children: { 2: glimpse(grandchild) },
        context: {},
      },
    })
  })

  it('maps two generations by Title and Preview by default, and to the depth asked', async () => {
    const { signedIn, secret } = await signedUp()
    const { root, child, grandchild } = await aSystem(signedIn)
    const client = await connect(bearer(secret))
    const mapped = await call(client, 'map')
    expect(mapped).toMatchObject({
      value: {
        tile: {
          ...glimpse(root),
          children: { 1: { ...glimpse(child), children: { 2: glimpse(grandchild) } } },
        },
        parent: null,
      },
    })
    expect(JSON.stringify(mapped)).not.toContain('# ')
    expect(await call(client, 'map', { id: child.id, depth: 0, fields: ['body'] })).toEqual({
      value: {
        tile: { _tag: 'Tile', id: child.id, body: '# Frontend' },
        parent: { id: root.id, title: 'Ada' },
      },
    })
  })

  it('refuses an input its schema does not allow, before the program runs', async () => {
    const { secret } = await signedUp()
    const client = await connect(bearer(secret))
    for (const [args, field] of [
      [{ depth: 4 }, 'depth'],
      [{ fields: [] }, 'fields'],
      [{ fields: ['title', 'title'] }, 'fields'],
      [{ id: 'not-an-id' }, 'id'],
    ] as const) {
      const { error } = await call(client, 'map', args)
      expect(error).toMatch(new RegExp(`^Input validation error: .*${field}: `))
    }
  })

  it("answers TileNotFound for another Account's Tile, as a tool error with the request id", async () => {
    const owner = await signedUp()
    const { child } = await aSystem(owner.signedIn)
    const { secret } = await signedUp()
    const client = await connect(bearer(secret))
    for (const tool of ['open_tile', 'map']) {
      const { error } = await call(client, tool, { id: child.id })
      expect(error).toMatch(/^TileNotFound: .+ \(request [0-9a-f-]{36}\)$/)
      expect(error).not.toContain('Frontend')
    }
  })

  it('refuses a request without a Key, with a revoked one, or with a cookie alone, unread', async () => {
    const { signedIn, cookie, key, secret } = await signedUp()
    await value(run(signedIn, Iam.revokeKey(key.id)))
    const refusals: ReadonlyArray<Record<string, string>> = [
      {},
      bearer(secret),
      { cookie },
      bearer('hf_not-a-key'),
    ]
    for (const headers of refusals) {
      const request = new Request(endpoint, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      })
      const response = await serveMcp(request)
      expect(response.status).toBe(401)
      expect(response.headers.get('www-authenticate')).toBe('Bearer')
      expect(request.bodyUsed).toBe(false)
      expect(await response.json()).toMatchObject({ error: { message: /^SignedOut: / } })
      await expect(connect(headers)).rejects.toThrow()
    }
  })

  it('answers GET and DELETE with 405: a stateless endpoint has no stream and no session', () => {
    const response = methodNotAllowed()
    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('POST')
  })
})
