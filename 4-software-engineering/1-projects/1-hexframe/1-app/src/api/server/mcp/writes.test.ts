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
    tile: { id: string; title: string; preview: string; body: string }
    parent: { id: string; title: string } | null
    children: Record<string, { _tag: string; id: string; title: string }>
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
    expect(said).toEqual(content('Layout'))
    const context = await call(client, 'create_tile', {
      parent: child.id,
      slot: -4,
      ...content('Accessibility'),
    })
    const { children, context: slots } = await opened(client, child.id)
    expect(children[3]).toMatchObject({ _tag: 'Tile', id, title: 'Layout' })
    expect(slots[-4]).toMatchObject({ _tag: 'Tile', id: (context.value as { id: string }).id })
  })

  it('edits only the fields given, and answers the Tile as it now reads', async () => {
    const { client, child } = await anAgent()
    expect(await call(client, 'edit_tile', { id: child.id, title: 'Client' })).toEqual({
      value: { id: child.id, title: 'Client', preview: child.preview, body: child.body },
    })
    expect((await opened(client, child.id)).tile).toMatchObject({ title: 'Client' })
  })

  it('moves a Tile with everything below it, and swaps two Tiles, answering null', async () => {
    const { client, root, child, grandchild, principles } = await anAgent()
    const moved = { id: grandchild.id, parent: root.id, slot: 2 }
    expect(await call(client, 'move_tile', moved)).toEqual({ value: null })
    expect((await opened(client)).children[2]).toMatchObject({ id: grandchild.id })
    expect(await call(client, 'swap_tiles', { a: child.id, b: principles.id })).toEqual({
      value: null,
    })
    const { children, context } = await opened(client)
    expect(children[1]).toMatchObject({ id: principles.id })
    expect(context[-1]).toMatchObject({ id: child.id })
  })

  it('deletes a Tile with everything below it, its References left broken', async () => {
    const { client, child, grandchild } = await anAgent()
    expect(await call(client, 'delete_tile', { id: child.id })).toEqual({ value: null })
    const { children, context } = await opened(client)
    expect(children[1]).toBeUndefined()
    expect(context[-2]).toEqual({ _tag: 'BrokenReference', target: child.id })
    const { error } = await call(client, 'open_tile', { id: grandchild.id })
    expect(error).toMatch(/^TileNotFound: /)
  })

  it('creates a Reference in a free Context slot, and deletes one', async () => {
    const { client, root, child, principles } = await anAgent()
    const reference = { parent: child.id, slot: -1, target: principles.id }
    expect(await call(client, 'create_reference', reference)).toEqual({ value: null })
    expect((await opened(client, child.id)).context[-1]).toMatchObject({
      _tag: 'Reference',
      tile: { id: principles.id },
    })
    expect(await call(client, 'delete_reference', { parent: root.id, slot: -2 })).toEqual({
      value: null,
    })
    expect((await opened(client)).context[-2]).toBeUndefined()
  })

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
    const refusals = [
      ['move_tile', { id: child.id, parent: grandchild.id, slot: 1 }, /^MovedUnderItself: .+move/],
      ['swap_tiles', { a: child.id, b: grandchild.id }, /^MovedUnderItself: .+swap/],
      ['move_tile', { id: root.id, parent: child.id, slot: 3 }, /^RootFixed: /],
      ['swap_tiles', { a: root.id, b: child.id }, /^RootFixed: /],
      ['delete_tile', { id: root.id }, /^RootFixed: /],
      ['edit_tile', { id: root.id, title: ' ' }, /^TitleMissing: .+ \(at fault: title\) /],
      ['delete_reference', { parent: missing, slot: -1 }, /^TileNotFound: /],
      ['create_reference', { parent: root.id, slot: -1, target: child.id }, /^DirectionTaken: /],
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
      ['edit_tile', { id: 'not-an-id' }, 'id'],
      ['move_tile', { id: child.id, parent: child.id, slot: 7 }, 'slot'],
      ['create_reference', { parent: child.id, slot: 1, target: child.id }, 'slot'],
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
      ['edit_tile', { id: owner.child.id, title: 'Taken over' }],
      ['delete_tile', { id: owner.child.id }],
      ['move_tile', { id: owner.grandchild.id, parent: owner.root.id, slot: 2 }],
      ['create_tile', { parent: owner.child.id, slot: 3, ...content('Planted') }],
    ] as const) {
      const { error } = await call(stranger, name, args)
      expect(error).toMatch(/^TileNotFound: /)
    }
    expect(await opened(owner.client, owner.child.id)).toMatchObject({
      tile: { title: 'Frontend' },
      children: { 2: { id: owner.grandchild.id } },
    })
    expect(Object.keys((await opened(owner.client, owner.child.id)).children)).toEqual(['2'])
  })

  it('refuses every write once its Key is revoked, and writes nothing', async () => {
    const { client, signedIn, key, root, child } = await anAgent()
    await value(run(signedIn, Iam.revokeKey(key.id)))
    await expect(
      call(client, 'create_tile', { parent: root.id, slot: 2, ...content('Late') }),
    ).rejects.toThrow()
    await expect(call(client, 'delete_tile', { id: child.id })).rejects.toThrow()
    const owner = await connect(bearer((await value(run(signedIn, Iam.issueKey('New')))).secret))
    const { children } = await opened(owner)
    expect(children[2]).toBeUndefined()
    expect(children[1]).toMatchObject({ id: child.id })
  })
})
