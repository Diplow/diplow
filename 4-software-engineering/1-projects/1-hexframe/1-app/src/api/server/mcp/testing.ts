// What the MCP endpoint's tests share: an Account signed up on a device of its own, with a Key, an
// MCP client that sends the endpoint its headers through the SDK's own transport, and a System to work
// on, all on the runtime's Better Auth and tiles over PGlite.
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { Exit, Option } from 'effect'

import * as Iam from '#/domains/iam/iam'

import * as Mapping from '../../mapping/programs'
import { noKey, run, type StartContext } from '../run'
import { serveMcp } from './mcp'

export const endpoint = 'http://localhost/mcp'

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
export async function value<A>(
  outcome: Promise<{ ok: true; value: A } | { ok: false }>,
): Promise<A> {
  const settled = await outcome
  if (!settled.ok) throw new Error(`Expected a success, got ${JSON.stringify(settled)}`)
  return settled.value
}

/** A new Account, signed in on a device, with one Key issued, and a request its Session proves. */
export async function signedUp() {
  const { context, cookie } = device()
  const credentials = { email: `${crypto.randomUUID()}@example.com`, password: 'lovelace1815' }
  await value(run(context(), Iam.signUp(credentials)))
  const session = await value(run(context(), Iam.proven))
  const signedIn: StartContext = { ...context(), session: Exit.succeed(session) }
  const { key, secret } = await value(run(signedIn, Iam.issueKey('Claude Code')))
  return { signedIn, cookie: cookie(), key, secret }
}

/** An MCP client that sends these headers to the handler, in the 2025 protocol or the newest. */
export async function connect(headers: Record<string, string>, mode: 'legacy' | 'auto' = 'legacy') {
  const client = new Client({ name: 'test', version: '1.0.0' }, { versionNegotiation: { mode } })
  const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
    requestInit: { headers },
    fetch: (input, init) => serveMcp(new Request(input, init)),
  })
  await client.connect(transport)
  return client
}

export const bearer = (secret: string) => ({ authorization: `Bearer ${secret}` })

/** A tool's answer: its JSON, or its error's text. */
export async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args })
  const [first] = result.content as ReadonlyArray<{ type: string; text: string }>
  const text = first?.text ?? ''
  return result.isError === true ? { error: text } : { value: JSON.parse(text) as unknown }
}

export const content = (title: string) => ({
  title,
  preview: `${title}, in short.`,
  body: `# ${title}`,
})

/**
 * The Account's System: the Root, named, a Child in Direction 1 with one of its own, a Context Tile,
 * a Reference to the Child, and a broken Reference.
 */
export async function aSystem(signedIn: StartContext) {
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
