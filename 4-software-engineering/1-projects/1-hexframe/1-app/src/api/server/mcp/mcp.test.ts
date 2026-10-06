import { Exit } from 'effect'
import { describe, expect, it, vi } from 'vitest'

import * as Iam from '#/domains/iam/iam'

import { provenKey, run } from '../run'
import { methodNotAllowed, serveMcp } from './mcp'
import { aSystem, bearer, call, connect, content, endpoint, signedUp, value } from './testing'

// The Key's lookup as it runs, but where a test makes it fail as a database that is down would.
vi.mock('../run', async (original) => {
  const actual = await original<typeof import('../run')>()
  return { ...actual, provenKey: vi.fn(actual.provenKey) }
})

// The MCP endpoint, driven by the SDK's own client over the handler, on the runtime's Better Auth and
// tiles over PGlite: an Account signs up, issues a Key, and an agent reads its System with it. The
// writes have their own file, ./writes.test.ts.

const glimpse = ({ id, title, preview }: { id: string; title: string; preview: string }) => ({
  _tag: 'Tile',
  id,
  title,
  preview,
})

describe('the tool table, as an agent lists it', () => {
  it.each(['legacy', 'auto'] as const)(
    'lists the reads, then a write per operation, each with its input in JSON Schema (%s protocol)',
    async (mode) => {
      const { secret } = await signedUp()
      const client = await connect(bearer(secret), mode)
      const { tools } = await client.listTools()
      const listed = tools.map(({ name, annotations, inputSchema }) => ({
        name,
        annotations,
        required: inputSchema.required ?? [],
      }))
      const read = { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
      const write = { ...read, readOnlyHint: false }
      const erase = { ...write, destructiveHint: true }
      expect(listed).toEqual([
        { name: 'open_tile', annotations: read, required: [] },
        { name: 'map', annotations: read, required: [] },
        {
          name: 'create_tile',
          annotations: write,
          required: ['parent', 'slot', 'title', 'preview', 'body'],
        },
        { name: 'edit_tile', annotations: write, required: ['id'] },
        { name: 'move_tile', annotations: write, required: ['id', 'parent', 'slot'] },
        { name: 'swap_tiles', annotations: write, required: ['a', 'b'] },
        { name: 'delete_tile', annotations: erase, required: ['id'] },
        { name: 'create_reference', annotations: write, required: ['parent', 'slot', 'target'] },
        { name: 'delete_reference', annotations: erase, required: ['parent', 'slot'] },
      ])
      for (const tool of tools) {
        expect(tool.description).toMatch(/Tile/)
        expect(tool.inputSchema).toMatchObject({ type: 'object' })
        for (const property of Object.values(tool.inputSchema.properties ?? {})) {
          expect(property).toHaveProperty('description')
        }
      }
    },
  )

  // An agent's contract: a change to how the app declares a tool's input leaves what an agent lists
  // as it was, word for word, unless the snapshot is updated on purpose.
  it('lists every tool as an agent has always seen it: name, description, input and annotations', async () => {
    const { secret } = await signedUp()
    const client = await connect(bearer(secret))
    const { tools } = await client.listTools()
    expect(tools).toMatchSnapshot()
  })

  it('teaches each write the refusals it may meet, and how to get past them', async () => {
    const { secret } = await signedUp()
    const client = await connect(bearer(secret))
    const { tools } = await client.listTools()
    const description = (name: string) => tools.find((tool) => tool.name === name)?.description
    for (const tool of tools.filter(({ annotations }) => annotations?.readOnlyHint === false)) {
      expect(tool.description).toMatch(/TileNotFound: .+; map or open_tile/)
      expect(tool.description).toMatch(/HelpReadOnly: that Tile is Help's/)
    }
    for (const name of ['open_tile', 'map']) {
      expect(description(name)).toMatch(/Help, hexframe's own guide, .+ id "help"/)
    }
    expect(description('create_tile')).toMatch(
      /6 Branches and 6 Leaves at most, so one more of either is refused: regroup .+ by moving them/,
    )
    expect(description('create_reference')).not.toMatch(/one more of either is refused/)
    for (const name of ['create_tile', 'move_tile', 'swap_tiles', 'create_reference']) {
      expect(description(name)).toMatch(/LeafHoldsNothing: a Leaf is one file, with nothing below/)
    }
    for (const name of ['edit_tile', 'delete_tile']) {
      expect(description(name)).not.toMatch(/LeafHoldsNothing/)
    }
    for (const name of ['create_tile', 'edit_tile']) {
      expect(description(name)).toMatch(/TitleMissing: .+ PreviewTooLong: /)
    }
    for (const name of ['move_tile', 'swap_tiles']) {
      expect(description(name)).toMatch(/RootFixed: .+ MovedUnderItself: /)
    }
    expect(description('delete_tile')).toMatch(/for good: no tool brings it back/)
  })
})

describe('Help, through the MCP endpoint', () => {
  it('says what hexframe is, and points an agent to Help', async () => {
    const { secret } = await signedUp()
    const client = await connect(bearer(secret))
    const instructions = client.getInstructions() ?? ''
    expect(instructions.split('\n')).toHaveLength(2)
    expect(instructions).toMatch(/^Hexframe holds the user's System/)
    expect(instructions).toContain('open_tile({ id: "help" })')
  })

  it('reads Help through the same tools as a System, by its paths', async () => {
    const { secret } = await signedUp()
    const client = await connect(bearer(secret))
    const opened = await call(client, 'open_tile', { id: 'help' })
    expect(opened).toMatchObject({
      value: {
        tile: { _tag: 'Tile', id: 'help', title: 'Hexframe' },
        parent: null,
        branches: { 1: { _tag: 'Tile', id: 'help/1' }, 6: { _tag: 'Tile', id: 'help/6' } },
        context: { '-1': { _tag: 'Tile', id: 'help/-1' } },
      },
    })
    expect(opened).toHaveProperty('value.tile.body')
    expect(await call(client, 'map', { id: 'help/3' })).toMatchObject({
      value: {
        tile: { _tag: 'Tile', id: 'help/3', context: { '-1': { _tag: 'Tile', id: 'help/3/-1' } } },
        parent: { id: 'help', title: 'Hexframe' },
      },
    })
    const { error } = await call(client, 'open_tile', { id: 'help/1/1' })
    expect(error).toMatch(/^TileNotFound: .+ \(request [0-9a-f-]{36}\)$/)
  })
})

describe('the MCP endpoint', () => {
  it('opens the Root by default: all it says, and its neighbours by Title and Preview only', async () => {
    const { signedIn, secret } = await signedUp()
    const { root, child, principles, gone } = await aSystem(signedIn)
    const client = await connect(bearer(secret))
    const opened = await call(client, 'open_tile')
    expect(opened).toEqual({
      value: {
        tile: { _tag: 'Tile', id: root.id, ...content('Ada') },
        parent: null,
        branches: { 1: glimpse(child) },
        leaves: {},
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
        branches: { 2: glimpse(grandchild) },
        leaves: {},
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
          branches: { 1: { ...glimpse(child), branches: { 2: glimpse(grandchild) } } },
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
      [{ id: 'help/../../x' }, 'id'],
      [{ id: 'help/3/' }, 'id'],
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

  it('answers a Key it could not check with 500, unread, and no challenge', async () => {
    vi.mocked(provenKey).mockResolvedValueOnce(Exit.die(new Error('the database is down')))
    const request = new Request(endpoint, {
      method: 'POST',
      headers: { ...bearer('hf_any'), 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    })
    const response = await serveMcp(request)
    expect(response.status).toBe(500)
    expect(response.headers.get('www-authenticate')).toBeNull()
    expect(request.bodyUsed).toBe(false)
    const { error } = (await response.json()) as { error: { message: string } }
    expect(error.message).toMatch(/^Unexpected: .+ \(request [0-9a-f-]{36}\)$/)
    expect(error.message).not.toContain('database')
  })

  it('answers GET and DELETE with 405: a stateless endpoint has no stream and no session', () => {
    const response = methodNotAllowed()
    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('POST')
  })
})
