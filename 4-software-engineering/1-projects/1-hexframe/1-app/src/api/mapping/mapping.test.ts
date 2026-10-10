import { Effect, Exit, Option, Schema } from 'effect'
import { describe, expect, expectTypeOf, it } from 'vitest'

import type { SignedOut } from '#/domains/iam/errors'
import type { KeyProof, Session } from '#/domains/iam/iam'
import type {
  DirectionTaken,
  HelpReadOnly,
  LeafHoldsNothing,
  MovedUnderItself,
  PreviewTooLong,
  RootFixed,
  TileIdTaken,
  TileNotFound,
  TitleMissing,
} from '#/domains/mapping/errors'
import { systemOf } from '#/domains/mapping/entities'

import type { Failure } from '../report/errors/failure'
import { noKey, run, type Services, type StartContext } from '../server/run'
import {
  HelpLanguage,
  NewReference,
  NewTile,
  ReferenceSlot,
  TileEdit,
  TileMove,
  TileRef,
  TileSwap,
} from './mapping'
import * as Mapping from './programs'

// Mapping's server functions, as their handlers run them: the program, through the helper, on the
// runtime's repositories, over PGlite. Start's validation runs before a handler; the schemas are
// checked on their own below.

/** Any of Mapping's programs, as the helper takes it. */
type Program = Effect.Effect<unknown, Failure, Services>

/**
 * A request from someone signed in as an Account no other test uses, by a Session or by one of their
 * Keys, or from nobody.
 */
function request(signedIn: boolean | 'by key' = true): StartContext {
  const account = { id: crypto.randomUUID(), email: 'someone@example.com' }
  const session: Session = { account, expiresAt: new Date(Date.now() + 60_000) }
  const key: KeyProof = { account, keyId: 'key-1' }
  return {
    requestId: 'req-mapping',
    scope: 'test',
    waitUntil: () => undefined,
    exchange: {
      url: 'http://localhost/_serverFn',
      headers: new Headers(),
      setCookies: () => undefined,
    },
    session: Exit.succeed(signedIn === true ? Option.some(session) : Option.none()),
    key: signedIn === 'by key' ? Exit.succeed(Option.some(key)) : noKey,
  }
}

const content = (title: string) => ({ title, preview: `${title}, in short.`, body: `# ${title}` })

/** The value of a call that must succeed. */
async function value<A>(outcome: Promise<{ ok: true; value: A } | { ok: false }>): Promise<A> {
  const settled = await outcome
  if (!settled.ok) throw new Error(`Expected a success, got ${JSON.stringify(settled)}`)
  return settled.value
}

/** The Account's System, read flat through its server function, as its tree, as the client builds it. */
async function systemTree(context: StartContext) {
  return systemOf(await value(run(context, Mapping.system)))
}

/** Someone's System, read once so its Root exists, with a Child of the Root in Direction 1. */
async function withAChild() {
  const context = request()
  const root = await systemTree(context)
  const child = await value(
    run(context, Mapping.createTile({ parent: root.id, slot: 1, ...content('Child') })),
  )
  return { context, root, child }
}

describe('the System, read flat', () => {
  it("reads the Account's System flat, owned by it, its Root added untitled on the first read", async () => {
    const context = request()
    const first = await value(run(context, Mapping.system))
    expect(first).toEqual({
      root: { _tag: 'Tile', id: first.root.id, title: '', preview: '', body: '' },
      tiles: {},
      owned: true,
    })
    expect((await value(run(context, Mapping.system))).root.id).toBe(first.root.id)
  })

  it('reads each Tile and Reference below the Root by id, where it stands', async () => {
    const { context, root, child } = await withAChild()
    const leaf = await value(
      run(context, Mapping.createTile({ parent: child.id, slot: { leaf: 2 }, ...content('Leaf') })),
    )
    await value(
      run(context, Mapping.createReference({ parent: child.id, slot: -3, target: root.id })),
    )
    const { tiles } = await value(run(context, Mapping.system))
    expect(tiles[child.id]).toEqual({ _tag: 'Tile', ...child, parent: root.id, slot: 1 })
    expect(tiles[leaf.id]).toEqual({ _tag: 'Tile', ...leaf, parent: child.id, slot: { leaf: 2 } })
    const references = Object.values(tiles).filter((held) => held._tag === 'Reference')
    expect(references).toEqual([
      { _tag: 'Reference', id: references[0]?.id, parent: child.id, slot: -3, target: root.id },
    ])
    expect(Object.keys(tiles)).toHaveLength(3)
  })
})

describe("Mapping's server functions", () => {
  it.each<readonly [string, Program]>([
    ['system', Mapping.system],
    ['createTile', Mapping.createTile({ parent: 'p', slot: 1, ...content('Child') })],
    ['editTile', Mapping.editTile({ id: 't', title: 'Renamed' })],
    ['moveTile', Mapping.moveTile({ id: 't', parent: 'p', slot: 2 })],
    ['swapTiles', Mapping.swapTiles({ a: 't', b: 'u' })],
    ['deleteTile', Mapping.deleteTile({ id: 't' })],
    ['createReference', Mapping.createReference({ parent: 'p', slot: -1, target: 't' })],
    ['deleteReference', Mapping.deleteReference({ parent: 'p', slot: -1 })],
  ])('%s asks for a Session, and sends SignedOut to nobody', async (_, program) => {
    expect(await run(request(false), program)).toEqual({
      ok: false,
      failure: { _tag: 'SignedOut', kind: 'Unauthenticated' },
      requestId: 'req-mapping',
    })
  })

  it('reads Help whole for anyone, signed out included, in the language asked', async () => {
    const english = await value(run(request(false), Mapping.help({ language: 'en' })))
    const french = await value(run(request(), Mapping.help({ language: 'fr' })))
    expect(english).toMatchObject({ _tag: 'Tile', id: 'help', title: 'Hexframe' })
    expect(english.branches[5]).toMatchObject({ id: 'help/5', title: 'Operations' })
    expect(french.branches[5]).toMatchObject({ id: 'help/5', title: 'Les opérations' })
    expect(french.branches[5]?.body).toMatch(/Déplacer/)
  })

  it('runs for an Account its Key proves as for one its Session proves', async () => {
    const context = request('by key')
    const root = await systemTree(context)
    await value(run(context, Mapping.createTile({ parent: root.id, slot: 1, ...content('Child') })))
    expect((await systemTree(context)).branches[1]).toMatchObject(content('Child'))
  })

  it('creates, edits, moves and deletes a Tile, and the System reads them back', async () => {
    const { context, root, child } = await withAChild()
    expect(child).toEqual({ id: child.id, ...content('Child') })

    const edited = await value(run(context, Mapping.editTile({ id: child.id, title: ' Renamed ' })))
    expect(edited).toEqual({ ...child, title: 'Renamed' })

    await value(run(context, Mapping.moveTile({ id: child.id, parent: root.id, slot: 4 })))
    const { branches } = await systemTree(context)
    expect(Object.keys(branches)).toEqual(['4'])
    expect(branches[4]).toMatchObject({ id: child.id, title: 'Renamed' })

    await value(run(context, Mapping.deleteTile({ id: child.id })))
    expect((await systemTree(context)).branches).toEqual({})
  })

  it('swaps two Tiles, each with everything below it, and refuses a swap along one line', async () => {
    const { context, root, child } = await withAChild()
    const other = await value(
      run(context, Mapping.createTile({ parent: root.id, slot: -5, ...content('Other') })),
    )
    const grandchild = await value(
      run(context, Mapping.createTile({ parent: child.id, slot: 2, ...content('Grandchild') })),
    )
    await value(run(context, Mapping.swapTiles({ a: child.id, b: other.id })))
    const swapped = await systemTree(context)
    expect(swapped.branches[1]).toMatchObject({ id: other.id, branches: {} })
    expect(swapped.context[-5]).toMatchObject({ id: child.id, branches: { 2: grandchild } })
    expect(await run(context, Mapping.swapTiles({ a: grandchild.id, b: child.id }))).toMatchObject({
      ok: false,
      failure: { _tag: 'MovedUnderItself', kind: 'Conflict' },
    })
  })

  it('puts a Reference in a Context slot and empties it', async () => {
    const { context, root, child } = await withAChild()
    await value(
      run(context, Mapping.createReference({ parent: root.id, slot: -2, target: child.id })),
    )
    expect((await systemTree(context)).context).toEqual({
      [-2]: { _tag: 'Reference', tile: child },
    })

    await value(run(context, Mapping.deleteReference({ parent: root.id, slot: -2 })))
    expect((await systemTree(context)).context).toEqual({})
  })

  it('sends a refusal as its tagged error, with its kind and the request id', async () => {
    const { context, root, child } = await withAChild()
    const refusals: ReadonlyArray<readonly [Program, string]> = [
      [Mapping.createTile({ parent: root.id, slot: 1, ...content('Another') }), 'DirectionTaken'],
      [Mapping.moveTile({ id: root.id, parent: child.id, slot: 1 }), 'RootFixed'],
      [Mapping.deleteTile({ id: root.id }), 'RootFixed'],
      [Mapping.swapTiles({ a: child.id, b: root.id }), 'RootFixed'],
      [Mapping.deleteTile({ id: crypto.randomUUID() }), 'TileNotFound'],
    ]
    for (const [program, tag] of refusals) {
      expect(await run(context, program)).toMatchObject({
        ok: false,
        failure: { _tag: tag },
        requestId: 'req-mapping',
      })
    }
  })

  it('refuses a move below the Tile itself, as a Conflict', async () => {
    const { context, child } = await withAChild()
    const grandchild = await value(
      run(context, Mapping.createTile({ parent: child.id, slot: 3, ...content('Grandchild') })),
    )
    expect(
      await run(context, Mapping.moveTile({ id: child.id, parent: grandchild.id, slot: 1 })),
    ).toMatchObject({ ok: false, failure: { _tag: 'MovedUnderItself', kind: 'Conflict' } })
  })

  it('sends an Invalid content with the field at fault, for the form to show', async () => {
    const { context, child } = await withAChild()
    expect(await run(context, Mapping.editTile({ id: child.id, title: '  ' }))).toMatchObject({
      ok: false,
      failure: { _tag: 'TitleMissing', kind: 'Invalid', fields: ['title'] },
    })
    expect(
      await run(context, Mapping.editTile({ id: child.id, preview: 'x'.repeat(351) })),
    ).toMatchObject({
      ok: false,
      failure: { _tag: 'PreviewTooLong', kind: 'Invalid', fields: ['preview'] },
    })
  })

  it("shows an Account nothing of another's System: its Tiles are TileNotFound", async () => {
    const { child } = await withAChild()
    const stranger = request()
    const theirRoot = await systemTree(stranger)
    expect(theirRoot.branches).toEqual({})
    const attempts: ReadonlyArray<Program> = [
      Mapping.editTile({ id: child.id, title: 'Mine now' }),
      Mapping.moveTile({ id: child.id, parent: theirRoot.id, slot: 1 }),
      Mapping.deleteTile({ id: child.id }),
      Mapping.swapTiles({ a: child.id, b: child.id }),
      Mapping.createTile({ parent: child.id, slot: 1, ...content('Squatter') }),
      Mapping.createReference({ parent: theirRoot.id, slot: -1, target: child.id }),
    ]
    for (const attempt of attempts) {
      expect(await run(stranger, attempt)).toMatchObject({
        ok: false,
        failure: { _tag: 'TileNotFound', kind: 'NotFound' },
      })
    }
  })
})

describe('a create under the id its caller chose', () => {
  it('creates a Tile under the id its caller chose, and refuses one taken as TileIdTaken', async () => {
    const { context, root, child } = await withAChild()
    const id = crypto.randomUUID()
    const chosen = Mapping.createTile({ id, parent: root.id, slot: 2, ...content('Chosen') })
    expect(await value(run(context, chosen))).toEqual({ id, ...content('Chosen') })
    const stranger = request()
    const theirRoot = await systemTree(stranger)
    const again = [
      [context, Mapping.createTile({ id, parent: root.id, slot: 3, ...content('Again') })],
      [
        stranger,
        Mapping.createTile({ id: child.id, parent: theirRoot.id, slot: 1, ...content('Theirs') }),
      ],
    ] as const
    for (const [someone, program] of again) {
      expect(await run(someone, program)).toEqual({
        ok: false,
        failure: { _tag: 'TileIdTaken', kind: 'Conflict' },
        requestId: 'req-mapping',
      })
    }
    expect(Object.keys((await systemTree(context)).branches)).toEqual(['1', '2'])
    expect((await systemTree(stranger)).branches).toEqual({})
  })
})

describe("the errors Mapping's server functions can fail with", () => {
  it('are each listed by its type, a write refusing Help', () => {
    type ErrorOf<P> = P extends Effect.Effect<unknown, infer E, unknown> ? E : never
    expectTypeOf<ErrorOf<typeof Mapping.system>>().toEqualTypeOf<SignedOut>()
    expectTypeOf<ErrorOf<ReturnType<typeof Mapping.help>>>().toEqualTypeOf<never>()
    expectTypeOf<ErrorOf<ReturnType<typeof Mapping.createTile>>>().toEqualTypeOf<
      | SignedOut
      | TitleMissing
      | PreviewTooLong
      | TileNotFound
      | DirectionTaken
      | TileIdTaken
      | LeafHoldsNothing
      | HelpReadOnly
    >()
    expectTypeOf<ErrorOf<ReturnType<typeof Mapping.editTile>>>().toEqualTypeOf<
      SignedOut | TitleMissing | PreviewTooLong | TileNotFound | HelpReadOnly
    >()
    expectTypeOf<ErrorOf<ReturnType<typeof Mapping.moveTile>>>().toEqualTypeOf<
      | SignedOut
      | TileNotFound
      | RootFixed
      | MovedUnderItself
      | DirectionTaken
      | LeafHoldsNothing
      | HelpReadOnly
    >()
    expectTypeOf<ErrorOf<ReturnType<typeof Mapping.swapTiles>>>().toEqualTypeOf<
      SignedOut | TileNotFound | RootFixed | MovedUnderItself | LeafHoldsNothing | HelpReadOnly
    >()
    expectTypeOf<ErrorOf<ReturnType<typeof Mapping.deleteTile>>>().toEqualTypeOf<
      SignedOut | TileNotFound | RootFixed | HelpReadOnly
    >()
    expectTypeOf<ErrorOf<ReturnType<typeof Mapping.createReference>>>().toEqualTypeOf<
      SignedOut | TileNotFound | DirectionTaken | LeafHoldsNothing | HelpReadOnly
    >()
    expectTypeOf<ErrorOf<ReturnType<typeof Mapping.deleteReference>>>().toEqualTypeOf<
      SignedOut | TileNotFound | HelpReadOnly
    >()
  })
})

describe("the schemas Mapping's server functions validate by", () => {
  const accepts = (schema: Schema.Top, input: unknown) => Schema.is(schema)(input)
  const p = crypto.randomUUID()
  const t = crypto.randomUUID()

  it('take a Branch or a Leaf in Directions 1 to 6 and a Context slot in -1 to -6, nothing else', () => {
    const at = (slot: unknown) => ({ parent: p, slot, ...content('Tile') })
    const leaves = [{ leaf: 1 }, { leaf: 6 }, { leaf: 0 }, { leaf: 7 }, { leaf: -1 }, { leaf: '1' }]
    expect(leaves.map((slot) => accepts(NewTile, at(slot)))).toEqual([
      true,
      true,
      false,
      false,
      false,
      false,
    ])
    expect([1, 6, -1, -6].map((slot) => accepts(NewTile, at(slot)))).toEqual([
      true,
      true,
      true,
      true,
    ])
    expect([0, 7, -7, 1.5].map((slot) => accepts(NewTile, at(slot)))).toEqual([
      false,
      false,
      false,
      false,
    ])
    expect(accepts(TileMove, { id: t, parent: p, slot: 3 })).toBe(true)
    expect(accepts(TileMove, { id: t, parent: p, slot: 9 })).toBe(false)
    expect(accepts(TileMove, { id: t, parent: p, slot: { leaf: 3 } })).toBe(true)
  })

  it("read Help in one of the app's languages, nothing else", () => {
    expect(['en', 'fr'].map((language) => accepts(HelpLanguage, { language }))).toEqual([
      true,
      true,
    ])
    expect(['de', '', undefined].map((language) => accepts(HelpLanguage, { language }))).toEqual([
      false,
      false,
      false,
    ])
  })

  it('swap two Tiles named by their ids', () => {
    expect(accepts(TileSwap, { a: t, b: p })).toBe(true)
    expect(accepts(TileSwap, { a: t })).toBe(false)
    expect(accepts(TileSwap, { a: t, b: 'root' })).toBe(false)
  })

  it('put a Reference in a Context slot only', () => {
    expect(accepts(NewReference, { parent: p, slot: -3, target: t })).toBe(true)
    expect(accepts(NewReference, { parent: p, slot: 3, target: t })).toBe(false)
    expect(accepts(NewReference, { parent: p, slot: { leaf: 3 }, target: t })).toBe(false)
    expect(accepts(ReferenceSlot, { parent: p, slot: -3 })).toBe(true)
    expect(accepts(ReferenceSlot, { parent: p, slot: 3 })).toBe(false)
  })

  it('edit any of the content, and bound every string', () => {
    expect(accepts(TileEdit, { id: t })).toBe(true)
    expect(accepts(TileEdit, { id: t, body: '# Body' })).toBe(true)
    expect(accepts(TileEdit, { id: t, body: 'x'.repeat(100_001) })).toBe(false)
    expect(accepts(NewTile, { parent: p, slot: 1, ...content('x'.repeat(1_001)) })).toBe(false)
    expect(accepts(TileEdit, { id: t, preview: 'x'.repeat(8_000) })).toBe(true)
    expect(accepts(TileEdit, { id: t, preview: 'x'.repeat(8_001) })).toBe(false)
  })

  it('take a Tile id only as a UUID', () => {
    expect(accepts(TileRef, { id: t })).toBe(true)
    expect(accepts(NewTile, { id: t, parent: p, slot: 1, ...content('Tile') })).toBe(true)
    expect(accepts(NewTile, { id: 'mine', parent: p, slot: 1, ...content('Tile') })).toBe(false)
    expect(['', 't', 'x'.repeat(36), `${t}x`].map((id) => accepts(TileRef, { id }))).toEqual([
      false,
      false,
      false,
      false,
    ])
    expect(accepts(NewReference, { parent: p, slot: -1, target: 'root' })).toBe(false)
  })
})

describe("Mapping's server functions, on Leaves", () => {
  it('creates a Leaf beside a Branch, and refuses anything under it as it crosses the wire', async () => {
    const { context, root, child } = await withAChild()
    const leaf = await value(
      run(context, Mapping.createTile({ parent: root.id, slot: { leaf: 1 }, ...content('Leaf') })),
    )
    const found = await systemTree(context)
    expect(found.leaves).toEqual({ 1: { _tag: 'Tile', ...leaf } })
    expect(found.branches[1]).toMatchObject({ id: child.id })
    const under = Mapping.createTile({ parent: leaf.id, slot: -1, ...content('Under') })
    expect(await run(context, under)).toMatchObject({
      ok: false,
      failure: { _tag: 'LeafHoldsNothing', kind: 'Conflict' },
    })
    const grandchild = Mapping.createTile({ parent: child.id, slot: 2, ...content('Grandchild') })
    await value(run(context, grandchild))
    expect(
      await run(context, Mapping.moveTile({ id: child.id, parent: root.id, slot: { leaf: 2 } })),
    ).toMatchObject({ ok: false, failure: { _tag: 'LeafHoldsNothing' } })
  })
})
