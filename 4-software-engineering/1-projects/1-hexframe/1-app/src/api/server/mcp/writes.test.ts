import type { Client } from '@modelcontextprotocol/client'
import { describe, expect, it } from 'vitest'

import * as Iam from '#/domains/iam/iam'

import { run } from '../run'
import { aSystem, bearer, call, connect, content, signedUp, value } from './testing'

// The write tools, driven by the SDK's own client over the endpoint, on the runtime's Better Auth and
// tiles over PGlite: each runs Mapping's operation for the Account its Key proves, and each refusal
// comes back as a tool error an agent can correct itself from.

/** An Account with a System, and an MCP client its Key signs in. */
async function anAgent() {
  const account = await signedUp()
  const system = await aSystem(account.signedIn)
  const client = await connect(bearer(account.secret))
  return { ...account, ...system, client }
}

/** What open_tile answers of a Tile: the slots of its Children and Context, and what each holds. */
async function opened(client: Client, id?: string) {
  const { value: answer } = await call(client, 'open_tile', id === undefined ? {} : { id })
  return answer as {
    tile: { id: string; version: number; title: string; preview: string; body: string }
    parent: { id: string; title: string } | null
    branches: Record<string, { _tag: string; id: string; title: string }>
    leaves: Record<string, { _tag: string; id: string; title: string }>
    context: Record<string, { _tag: string; id?: string; tile?: { id: string } }>
  }
}

const requestId = String.raw`\(request [0-9a-f-]{36}\)$`

const missing = crypto.randomUUID()

describe('the MCP write tools', () => {
  it('creates a Child and a Context Tile, and answers each with its id', async () => {
    const { client, child } = await anAgent()
    const created = await call(client, 'create_tile', {
      parent: child.id,
      slot: 3,
      ...content('Layout'),
    })
    const { id, ...said } = created.value as { id: string }
    expect(said).toEqual({ ...content('Layout'), version: 1 })
    const context = await call(client, 'create_tile', {
      parent: child.id,
      slot: -4,
      ...content('Accessibility'),
    })
    const { branches, context: slots } = await opened(client, child.id)
    expect(branches[3]).toMatchObject({ _tag: 'Tile', id, title: 'Layout' })
    expect(slots[-4]).toMatchObject({ _tag: 'Tile', id: (context.value as { id: string }).id })
  })

  it('edits only the fields given, and answers the Tile as it now reads, at its new Version', async () => {
    const { client, child } = await anAgent()
    const edit = { id: child.id, version: child.version, title: 'Client' }
    expect(await call(client, 'edit_tile', edit)).toEqual({
      value: {
        id: child.id,
        title: 'Client',
        preview: child.preview,
        body: child.body,
        version: child.version + 1,
      },
    })
    expect((await opened(client, child.id)).tile).toMatchObject({
      title: 'Client',
      version: child.version + 1,
    })
  })

  it('refuses a write naming a Version its Tile no longer has, and writes nothing', async () => {
    const { client, child } = await anAgent()
    // Read by the agent at its Version, then changed by the user before the agent writes.
    const read = (await opened(client, child.id)).tile.version
    await call(client, 'edit_tile', { id: child.id, version: read, title: 'The user’s' })
    const before = await opened(client, child.id)
    for (const [name, args] of [
      ['edit_tile', { id: child.id, version: read, title: 'The agent’s' }],
      ['delete_tile', { id: child.id, version: read }],
      ['create_reference', { parent: child.id, parentVersion: read, slot: -1, target: child.id }],
    ] as const) {
      const { error } = await call(client, name, args)
      expect(error).toMatch(new RegExp(`^TileChanged: .+ ${requestId}`))
    }
    expect(await opened(client, child.id)).toEqual(before)
  })

  it('moves a Tile with everything below it, and swaps two Tiles, answering null', async () => {
    const { client, root, child, grandchild, principles } = await anAgent()
    const moved = { id: grandchild.id, version: grandchild.version, parent: root.id, slot: 2 }
    expect(await call(client, 'move_tile', moved)).toEqual({ value: null })
    expect((await opened(client)).branches[2]).toMatchObject({ id: grandchild.id })
    const swap = { a: child.id, aVersion: 1, b: principles.id, bVersion: 1 }
    expect(await call(client, 'swap_tiles', swap)).toEqual({ value: null })
    const { branches, context } = await opened(client)
    expect(branches[1]).toMatchObject({ id: principles.id })
    expect(context[-1]).toMatchObject({ id: child.id })
  })

  it('deletes a Tile with everything below it, its References left broken', async () => {
    const { client, child, grandchild } = await anAgent()
    expect(await call(client, 'delete_tile', { id: child.id, version: 1 })).toEqual({ value: null })
    const { branches, context } = await opened(client)
    expect(branches[1]).toBeUndefined()
    expect(context[-2]).toEqual({ _tag: 'BrokenReference', target: child.id })
    const { error } = await call(client, 'open_tile', { id: grandchild.id })
    expect(error).toMatch(/^TileNotFound: /)
  })

  it('creates a Reference in a free Context slot, and deletes one', async () => {
    const { client, root, child, principles } = await anAgent()
    const reference = { parent: child.id, parentVersion: 1, slot: -1, target: principles.id }
    expect(await call(client, 'create_reference', reference)).toEqual({ value: null })
    expect((await opened(client, child.id)).context[-1]).toMatchObject({
      _tag: 'Reference',
      tile: { id: principles.id },
    })
    const slot = { parent: root.id, parentVersion: root.version, slot: -2 }
    expect(await call(client, 'delete_reference', slot)).toEqual({ value: null })
    expect((await opened(client)).context[-2]).toBeUndefined()
  })
})

describe('the MCP write tools, refusing', () => {
  it.each([
    ['create_tile', { slot: 1 }, 'DirectionTaken', /holds a tile/],
    ['create_tile', { slot: 2, title: '' }, 'TitleMissing', /\(at fault: title\)/],
    ['create_tile', { slot: 2, preview: 'p'.repeat(351) }, 'PreviewTooLong', /at fault: preview/],
    ['create_tile', { parent: missing, slot: 2 }, 'TileNotFound', /doesn't exist/],
  ] as const)(
    'refuses %s with %s as a tool error, and writes nothing',
    async (name, args, tag, sentence) => {
      const { client, root } = await anAgent()
      const before = await opened(client)
      const { error } = await call(client, name, { parent: root.id, ...content('New'), ...args })
      expect(error).toMatch(new RegExp(`^${tag}: .+ ${requestId}`))
      expect(error).toMatch(sentence)
      expect(await opened(client)).toEqual(before)
    },
  )

  it('refuses a move or a swap below itself, and the Root, each in its own words', async () => {
    const { client, root, child, grandchild } = await anAgent()
    const v = { version: 1 }
    const rootV = { version: root.version }
    const both = { aVersion: 1, bVersion: 1 }
    const refusals = [
      [
        'move_tile',
        { id: child.id, ...v, parent: grandchild.id, slot: 1 },
        /^MovedUnderItself: .+move/,
      ],
      ['swap_tiles', { a: child.id, b: grandchild.id, ...both }, /^MovedUnderItself: .+swap/],
      ['move_tile', { id: root.id, ...rootV, parent: child.id, slot: 3 }, /^RootFixed: /],
      [
        'swap_tiles',
        { a: root.id, b: child.id, aVersion: root.version, bVersion: 1 },
        /^RootFixed: /,
      ],
      ['delete_tile', { id: root.id, ...rootV }, /^RootFixed: /],
      [
        'edit_tile',
        { id: root.id, ...rootV, title: ' ' },
        /^TitleMissing: .+ \(at fault: title\) /,
      ],
      ['delete_reference', { parent: missing, parentVersion: 1, slot: -1 }, /^TileNotFound: /],
      [
        'create_reference',
        { parent: root.id, parentVersion: root.version, slot: -1, target: child.id },
        /^DirectionTaken: /,
      ],
    ] as const
    for (const [name, args, refusal] of refusals) {
      const { error } = await call(client, name, args)
      expect(error).toMatch(refusal)
      expect(error).toMatch(new RegExp(requestId))
    }
  })

  it('refuses an input its schema does not allow, before the program runs', async () => {
    const { client, child } = await anAgent()
    for (const [name, args, field] of [
      ['edit_tile', { id: 'not-an-id', version: 1 }, 'id'],
      ['edit_tile', { id: child.id, title: 'No version' }, 'version'],
      ['edit_tile', { id: child.id, version: 0 }, 'version'],
      ['move_tile', { id: child.id, version: 1, parent: child.id, slot: 7 }, 'slot'],
      [
        'create_reference',
        { parent: child.id, parentVersion: 1, slot: 1, target: child.id },
        'slot',
      ],
      ['create_tile', { parent: child.id, slot: 2, title: 'No preview', body: '' }, 'preview'],
    ] as const) {
      const { error } = await call(client, name, args)
      expect(error).toMatch(new RegExp(`^Input validation error: .*${field}`))
    }
  })

  it("answers TileNotFound for another Account's Tile, and leaves it as it was", async () => {
    const owner = await anAgent()
    const stranger = await connect(bearer((await signedUp()).secret))
    for (const [name, args] of [
      ['edit_tile', { id: owner.child.id, version: 1, title: 'Taken over' }],
      ['delete_tile', { id: owner.child.id, version: 1 }],
      ['move_tile', { id: owner.grandchild.id, version: 1, parent: owner.root.id, slot: 2 }],
      ['create_tile', { parent: owner.child.id, slot: 3, ...content('Planted') }],
    ] as const) {
      const { error } = await call(stranger, name, args)
      expect(error).toMatch(/^TileNotFound: /)
    }
    expect(await opened(owner.client, owner.child.id)).toMatchObject({
      tile: { title: 'Frontend' },
      branches: { 2: { id: owner.grandchild.id } },
    })
    expect(Object.keys((await opened(owner.client, owner.child.id)).branches)).toEqual(['2'])
  })

  it('refuses every write once its Key is revoked, and writes nothing', async () => {
    const { client, signedIn, key, root, child } = await anAgent()
    await value(run(signedIn, Iam.revokeKey(key.id)))
    await expect(
      call(client, 'create_tile', { parent: root.id, slot: 2, ...content('Late') }),
    ).rejects.toThrow()
    await expect(call(client, 'delete_tile', { id: child.id, version: 1 })).rejects.toThrow()
    const owner = await connect(bearer((await value(run(signedIn, Iam.issueKey('New')))).secret))
    const { branches } = await opened(owner)
    expect(branches[2]).toBeUndefined()
    expect(branches[1]).toMatchObject({ id: child.id })
  })
})

describe('the MCP write tools, on Leaves', () => {
  it('creates a Leaf in a Leaf slot, beside a Branch, and nothing under it', async () => {
    const { client, root } = await anAgent()
    const created = await call(client, 'create_tile', {
      parent: root.id,
      slot: { leaf: 1 },
      ...content('Readme'),
    })
    const { id } = created.value as { id: string }
    const { branches, leaves } = await opened(client)
    expect(leaves[1]).toEqual({
      _tag: 'Tile',
      id,
      version: 1,
      title: 'Readme',
      preview: content('Readme').preview,
    })
    expect(branches[1]).toBeDefined()
    const { error } = await call(client, 'create_tile', {
      parent: id,
      slot: 1,
      ...content('Below'),
    })
    expect(error).toMatch(new RegExp(`^LeafHoldsNothing: .+ ${requestId}`))
    expect((await opened(client, id)).branches).toEqual({})
  })
})
