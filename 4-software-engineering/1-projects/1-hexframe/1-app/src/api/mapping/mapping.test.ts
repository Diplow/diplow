import { Effect, Exit, Option, Schema } from 'effect'
import { describe, expect, expectTypeOf, it } from 'vitest'

import type { SignedOut } from '#/domains/iam/errors'
import { type KeyProof, type Session, signedIn } from '#/domains/iam/iam'
import type {
  DirectionTaken,
  LeafHoldsNothing,
  MovedUnderItself,
  NotAllowed,
  PreviewTooLong,
  RootFixed,
  Shipped,
  TileChanged,
  TileIdTaken,
  TileNotFound,
  TitleMissing,
} from '#/domains/mapping/errors'
import { systemOf } from '#/domains/mapping/entities'
import * as Service from '#/domains/mapping/mapping'
import { EditTile } from '#/domains/mapping/operations'
import { transactional } from '#/repositories/database/database'
import { granted } from '#/repositories/database/tiles/testing'

import type { Failure } from '../report/errors/failure'
import { noKey, run, type Services, type StartContext } from '../server/run'
import {
  NewReference,
  NewTile,
  ReferenceSlot,
  ShippedRead,
  TileEdit,
  TileMove,
  TileExport,
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
function request(
  signedIn: boolean | 'by key' = true,
  account = { id: crypto.randomUUID(), email: 'someone@example.com' },
): StartContext {
  const session: Session = { account, expiresAt: new Date(Date.now() + 60_000) }
  const key: KeyProof = { account, by: { _tag: 'Key', keyId: 'key-1' } }
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
const systemTree = async (context: StartContext) =>
  systemOf(await value(run(context, Mapping.system)))

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
      root: { _tag: 'Tile', id: first.root.id, title: '', preview: '', body: '', version: 1 },
      tiles: {},
      version: 0,
      rights: { [first.root.id]: ['read', 'write', '@'] },
      gaps: {},
      pinned: {},
      asOwner: true,
    })
    expect((await value(run(context, Mapping.system))).root.id).toBe(first.root.id)
  })

  it('reads each Tile and Reference below the Root by id, where it stands', async () => {
    const { context, root, child } = await withAChild()
    const leaf = await value(
      run(context, Mapping.createTile({ parent: child.id, slot: { leaf: 2 }, ...content('Leaf') })),
    )
    await value(
      run(
        context,
        Mapping.createReference({ parent: child.id, parentVersion: 1, slot: -3, target: root.id }),
      ),
    )
    const { tiles } = await value(run(context, Mapping.system))
    // The Reference taking a Context slot of the Child counted on its Version.
    expect(tiles[child.id]).toEqual({
      _tag: 'Tile',
      ...child,
      version: 2,
      parent: root.id,
      slot: 1,
    })
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
    ['editTile', Mapping.editTile({ id: 't', version: 1, title: 'Renamed' })],
    ['moveTile', Mapping.moveTile({ id: 't', version: 1, parent: 'p', slot: 2 })],
    ['swapTiles', Mapping.swapTiles({ a: 't', aVersion: 1, b: 'u', bVersion: 1 })],
    ['deleteTile', Mapping.deleteTile({ id: 't', version: 1 })],
    [
      'createReference',
      Mapping.createReference({ parent: 'p', parentVersion: 1, slot: -1, target: 't' }),
    ],
    ['deleteReference', Mapping.deleteReference({ parent: 'p', parentVersion: 1, slot: -1 })],
  ])('%s asks for a Session, and sends SignedOut to nobody', async (_, program) => {
    expect(await run(request(false), program)).toEqual({
      ok: false,
      failure: { _tag: 'SignedOut', kind: 'Unauthenticated' },
      requestId: 'req-mapping',
    })
  })

  it('reads Help whole for anyone, signed out included, in the language asked', async () => {
    const english = await value(
      run(request(false), Mapping.shipped({ root: 'help', language: 'en' })),
    )
    const french = await value(run(request(), Mapping.shipped({ root: 'help', language: 'fr' })))
    expect(english).toMatchObject({ _tag: 'Tile', id: 'help', title: 'Help' })
    expect(english.branches[5]).toMatchObject({ id: 'help/5', title: 'Operations' })
    expect(french.branches[5]).toMatchObject({ id: 'help/5', title: 'Les opérations' })
    expect(french.branches[5]?.body).toMatch(/Déplacer/)
  })

  it('reads the tutorial whole for anyone, signed out included, in the language asked', async () => {
    const english = await value(
      run(request(false), Mapping.shipped({ root: 'tutorial', language: 'en' })),
    )
    const french = await value(
      run(request(), Mapping.shipped({ root: 'tutorial', language: 'fr' })),
    )
    expect(english).toMatchObject({ _tag: 'Tile', id: 'tutorial' })
    expect(english.branches[1]).toMatchObject({ id: 'tutorial/1' })
    expect(french.branches[1]).toMatchObject({ id: 'tutorial/1' })
    expect(french.body).not.toBe(english.body)
  })

  it('runs for an Account its Key proves as for one its Session proves', async () => {
    const context = request('by key')
    const root = await systemTree(context)
    await value(run(context, Mapping.createTile({ parent: root.id, slot: 1, ...content('Child') })))
    expect((await systemTree(context)).branches[1]).toMatchObject(content('Child'))
  })

  it('creates, edits, moves and deletes a Tile, and the System reads them back', async () => {
    const { context, root, child } = await withAChild()
    expect(child).toEqual({ id: child.id, ...content('Child'), version: 1 })

    const edited = await value(
      run(context, Mapping.editTile({ id: child.id, version: 1, title: ' Renamed ' })),
    )
    expect(edited).toEqual({ ...child, title: 'Renamed', version: 2 })

    await value(
      run(context, Mapping.moveTile({ id: child.id, version: 2, parent: root.id, slot: 4 })),
    )
    const { branches } = await systemTree(context)
    expect(Object.keys(branches)).toEqual(['4'])
    expect(branches[4]).toMatchObject({ id: child.id, title: 'Renamed' })

    await value(run(context, Mapping.deleteTile({ id: child.id, version: 3 })))
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
    await value(
      run(context, Mapping.swapTiles({ a: child.id, aVersion: 1, b: other.id, bVersion: 1 })),
    )
    const swapped = await systemTree(context)
    expect(swapped.branches[1]).toMatchObject({ id: other.id, branches: {} })
    expect(swapped.context[-5]).toMatchObject({ id: child.id, branches: { 2: grandchild } })
    const inLine = Mapping.swapTiles({ a: grandchild.id, aVersion: 1, b: child.id, bVersion: 2 })
    expect(await run(context, inLine)).toMatchObject({
      ok: false,
      failure: { _tag: 'MovedUnderItself', kind: 'Conflict' },
    })
  })

  it('puts a Reference in a Context slot and empties it', async () => {
    const { context, root, child } = await withAChild()
    await value(
      run(
        context,
        Mapping.createReference({ parent: root.id, parentVersion: 1, slot: -2, target: child.id }),
      ),
    )
    expect((await systemTree(context)).context).toEqual({
      [-2]: { _tag: 'Reference', tile: { id: child.id, ...content('Child') } },
    })

    await value(
      run(context, Mapping.deleteReference({ parent: root.id, parentVersion: 2, slot: -2 })),
    )
    expect((await systemTree(context)).context).toEqual({})
  })
})

describe("Mapping's server functions, refusing", () => {
  it('sends a refusal as its tagged error, with its kind and the request id', async () => {
    const { context, root, child } = await withAChild()
    const refusals: ReadonlyArray<readonly [Program, string]> = [
      [Mapping.createTile({ parent: root.id, slot: 1, ...content('Another') }), 'DirectionTaken'],
      [Mapping.moveTile({ id: root.id, version: 1, parent: child.id, slot: 1 }), 'RootFixed'],
      [Mapping.deleteTile({ id: root.id, version: 1 }), 'RootFixed'],
      [Mapping.swapTiles({ a: child.id, aVersion: 1, b: root.id, bVersion: 1 }), 'RootFixed'],
      [Mapping.deleteTile({ id: crypto.randomUUID(), version: 1 }), 'TileNotFound'],
      [Mapping.editTile({ id: child.id, version: 2, title: 'Ahead' }), 'TileChanged'],
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
      await run(
        context,
        Mapping.moveTile({ id: child.id, version: 1, parent: grandchild.id, slot: 1 }),
      ),
    ).toMatchObject({ ok: false, failure: { _tag: 'MovedUnderItself', kind: 'Conflict' } })
  })

  it('sends an Invalid content with the field at fault, for the form to show', async () => {
    const { context, child } = await withAChild()
    expect(
      await run(context, Mapping.editTile({ id: child.id, version: 1, title: '  ' })),
    ).toMatchObject({
      ok: false,
      failure: { _tag: 'TitleMissing', kind: 'Invalid', fields: ['title'] },
    })
    expect(
      await run(context, Mapping.editTile({ id: child.id, version: 1, preview: 'x'.repeat(351) })),
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
      Mapping.editTile({ id: child.id, version: 1, title: 'Mine now' }),
      Mapping.moveTile({ id: child.id, version: 1, parent: theirRoot.id, slot: 1 }),
      Mapping.deleteTile({ id: child.id, version: 1 }),
      Mapping.swapTiles({ a: child.id, aVersion: 1, b: child.id, bVersion: 1 }),
      Mapping.createTile({ parent: child.id, slot: 1, ...content('Squatter') }),
      Mapping.createReference({
        parent: theirRoot.id,
        parentVersion: 1,
        slot: -1,
        target: child.id,
      }),
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
    expect(await value(run(context, chosen))).toEqual({ id, ...content('Chosen'), version: 1 })
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
  it('are each listed by its type, a write refusing the Systems hexframe ships and what the actor may not do', () => {
    type ErrorOf<P> = P extends Effect.Effect<unknown, infer E, unknown> ? E : never
    expectTypeOf<ErrorOf<typeof Mapping.system>>().toEqualTypeOf<SignedOut | TileNotFound>()
    expectTypeOf<ErrorOf<ReturnType<typeof Mapping.systemAt>>>().toEqualTypeOf<
      SignedOut | TileNotFound
    >()
    expectTypeOf<ErrorOf<ReturnType<typeof Mapping.shipped>>>().toEqualTypeOf<never>()
    expectTypeOf<ErrorOf<ReturnType<typeof Mapping.createTile>>>().toEqualTypeOf<
      | SignedOut
      | TitleMissing
      | PreviewTooLong
      | TileNotFound
      | DirectionTaken
      | TileIdTaken
      | LeafHoldsNothing
      | NotAllowed
      | Shipped
    >()
    expectTypeOf<ErrorOf<ReturnType<typeof Mapping.editTile>>>().toEqualTypeOf<
      SignedOut | TitleMissing | PreviewTooLong | TileNotFound | TileChanged | NotAllowed | Shipped
    >()
    expectTypeOf<ErrorOf<ReturnType<typeof Mapping.moveTile>>>().toEqualTypeOf<
      | SignedOut
      | TileNotFound
      | TileChanged
      | RootFixed
      | MovedUnderItself
      | DirectionTaken
      | LeafHoldsNothing
      | NotAllowed
      | Shipped
    >()
    expectTypeOf<ErrorOf<ReturnType<typeof Mapping.swapTiles>>>().toEqualTypeOf<
      | SignedOut
      | TileNotFound
      | TileChanged
      | RootFixed
      | MovedUnderItself
      | LeafHoldsNothing
      | NotAllowed
      | Shipped
    >()
    expectTypeOf<ErrorOf<ReturnType<typeof Mapping.deleteTile>>>().toEqualTypeOf<
      SignedOut | TileNotFound | TileChanged | RootFixed | NotAllowed | Shipped
    >()
    expectTypeOf<ErrorOf<ReturnType<typeof Mapping.createReference>>>().toEqualTypeOf<
      | SignedOut
      | TileNotFound
      | TileChanged
      | DirectionTaken
      | LeafHoldsNothing
      | NotAllowed
      | Shipped
    >()
    expectTypeOf<ErrorOf<ReturnType<typeof Mapping.deleteReference>>>().toEqualTypeOf<
      SignedOut | TileNotFound | TileChanged | NotAllowed | Shipped
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
    expect(accepts(TileMove, { id: t, version: 1, parent: p, slot: 3 })).toBe(true)
    expect(accepts(TileMove, { id: t, version: 1, parent: p, slot: 9 })).toBe(false)
    expect(accepts(TileMove, { id: t, version: 1, parent: p, slot: { leaf: 3 } })).toBe(true)
  })

  it("read Help or the tutorial, by its Root, in one of the app's languages, nothing else", () => {
    const read = (root: unknown, language: unknown) => accepts(ShippedRead, { root, language })
    expect([read('help', 'en'), read('help', 'fr'), read('tutorial', 'fr')]).toEqual([
      true,
      true,
      true,
    ])
    expect(['de', '', undefined].map((language) => read('help', language))).toEqual([
      false,
      false,
      false,
    ])
    expect(['helper', 'tutorial/1', '', undefined].map((root) => read(root, 'en'))).toEqual([
      false,
      false,
      false,
      false,
    ])
  })

  it('swap two Tiles named by their ids, each with the Version read of it', () => {
    expect(accepts(TileSwap, { a: t, aVersion: 1, b: p, bVersion: 3 })).toBe(true)
    expect(accepts(TileSwap, { a: t, aVersion: 1 })).toBe(false)
    expect(accepts(TileSwap, { a: t, b: p })).toBe(false)
    expect(accepts(TileSwap, { a: t, aVersion: 1, b: 'root', bVersion: 1 })).toBe(false)
  })

  it('put a Reference in a Context slot only, naming the Version of the Tile holding it', () => {
    const slot = (at: unknown) => ({ parent: p, parentVersion: 1, slot: at })
    expect(accepts(NewReference, { ...slot(-3), target: t })).toBe(true)
    expect(accepts(NewReference, { ...slot(3), target: t })).toBe(false)
    expect(accepts(NewReference, { ...slot({ leaf: 3 }), target: t })).toBe(false)
    expect(accepts(NewReference, { parent: p, slot: -3, target: t })).toBe(false)
    expect(accepts(ReferenceSlot, slot(-3))).toBe(true)
    expect(accepts(ReferenceSlot, slot(3))).toBe(false)
    expect(accepts(ReferenceSlot, { parent: p, slot: -3 })).toBe(false)
  })

  it('edit any of the content, naming the Version read, and bound every string', () => {
    expect(accepts(TileEdit, { id: t, version: 1 })).toBe(true)
    expect(accepts(TileEdit, { id: t })).toBe(false)
    expect(accepts(TileEdit, { id: t, version: 0 })).toBe(false)
    expect(accepts(TileEdit, { id: t, version: 1, body: '# Body' })).toBe(true)
    expect(accepts(TileEdit, { id: t, version: 1, body: 'x'.repeat(100_001) })).toBe(false)
    expect(accepts(NewTile, { parent: p, slot: 1, ...content('x'.repeat(1_001)) })).toBe(false)
    expect(accepts(TileEdit, { id: t, version: 1, preview: 'x'.repeat(8_000) })).toBe(true)
    expect(accepts(TileEdit, { id: t, version: 1, preview: 'x'.repeat(8_001) })).toBe(false)
  })

  it('take a Tile id only as a UUID', () => {
    expect(accepts(TileExport, { id: t })).toBe(true)
    expect(accepts(NewTile, { id: t, parent: p, slot: 1, ...content('Tile') })).toBe(true)
    expect(accepts(NewTile, { id: 'mine', parent: p, slot: 1, ...content('Tile') })).toBe(false)
    expect(['', 't', 'x'.repeat(36), `${t}x`].map((id) => accepts(TileExport, { id }))).toEqual([
      false,
      false,
      false,
      false,
    ])
    expect(accepts(NewReference, { parent: p, parentVersion: 1, slot: -1, target: 'root' })).toBe(
      false,
    )
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
      await run(
        context,
        Mapping.moveTile({ id: child.id, version: 1, parent: root.id, slot: { leaf: 2 } }),
      ),
    ).toMatchObject({ ok: false, failure: { _tag: 'LeafHoldsNothing' } })
  })
})

/** The Account the request proves, by its id. */
const signedInAccount = Effect.map(signedIn, ({ account }) => account.id)

describe('the Tiles a Turn is shown, as Mapping reads them', () => {
  it('glimpses Tiles by Title and Preview in the order asked, each once, none of another Account’s or unknown', async () => {
    const { context, root, child } = await withAChild()
    const sibling = await value(
      run(context, Mapping.createTile({ parent: root.id, slot: 2, ...content('Sibling') })),
    )
    const stranger = await withAChild()
    const ids = [sibling.id, child.id, sibling.id, crypto.randomUUID(), stranger.child.id]
    const glimpsed = await value(
      run(
        context,
        Effect.flatMap(signedInAccount, (id) =>
          Effect.flatMap(Mapping.actingOnOwn(id, { session: true }), (acting) =>
            Service.glimpses(acting, ids),
          ),
        ),
      ),
    )
    expect(glimpsed).toEqual([
      { id: sibling.id, title: 'Sibling', preview: 'Sibling, in short.' },
      { id: child.id, title: 'Child', preview: 'Child, in short.' },
    ])
    const own = await run(
      context,
      Effect.flatMap(signedInAccount, (id) =>
        Effect.flatMap(Mapping.actingOnOwn(id, { session: true }), (acting) =>
          Service.ownTile(acting, child.id),
        ),
      ),
    )
    expect(own.ok).toBe(true)
    const theirs = await run(
      context,
      Effect.flatMap(signedInAccount, (id) =>
        Effect.flatMap(Mapping.actingOnOwn(id, { session: true }), (acting) =>
          Service.ownTile(acting, stranger.child.id),
        ),
      ),
    )
    expect(theirs).toMatchObject({ ok: false, failure: { _tag: 'TileNotFound' } })
  })
})

describe('who acts, and on which System', () => {
  it('lets no actor reach a System it does not own past its star’s card, even by naming its star', async () => {
    const { context, root, child } = await withAChild()
    const stranger = request()
    const strangerId = await value(run(stranger, signedInAccount))
    const named = (system: string): Service.Acting => ({
      actor: { account: strangerId, groups: [], owners: [strangerId], session: true },
      system,
    })
    const attempts = (acting: Service.Acting): ReadonlyArray<Program> => [
      Service.ownTile(acting, child.id),
      transactional(
        Service.editTile(acting, new EditTile({ id: child.id, version: 1, title: 'Mine now' })),
      ),
      // The change that is no Operation, an import's, before it looks at a row.
      transactional(
        Service.changing(acting, [], () => Effect.succeed({ answer: null, events: [] })),
      ),
    ]
    // The other Account's star, and a star that names no System at all, refused alike; and a read
    // of the System, which shows anyone a star's card, and its Version, refused that one.
    const nowhere = named(crypto.randomUUID())
    for (const attempt of [
      ...attempts(named(root.id)),
      ...attempts(nowhere),
      Service.system(nowhere),
      Service.systemVersion(nowhere),
    ]) {
      expect(await run(stranger, attempt)).toMatchObject({
        ok: false,
        failure: { _tag: 'TileNotFound', kind: 'NotFound' },
      })
    }
    // The other Account's star read: its card, untitled, and nothing below it; its Version is how
    // that stands (`operations/rights/seen.test.ts`).
    expect(await value(run(stranger, Service.system(named(root.id))))).toMatchObject({
      root: { id: root.id, title: '', body: '' },
      tiles: {},
      rights: { [root.id]: [] },
    })
    // The Titles of what it may read: the star's alone, its card's, of the other Account's.
    expect(await run(stranger, Service.titles(named(root.id), [root.id, child.id]))).toEqual({
      ok: true,
      value: { [root.id]: '' },
    })
    expect((await systemTree(context)).branches[1]).toMatchObject({ title: 'Child', version: 1 })
  })
})

describe('a move that would open a Tile to someone', () => {
  it('is the owner’s from a Session, and refused through one of their Keys', async () => {
    const account = { id: crypto.randomUUID(), email: 'someone@example.com' }
    const [bySession, byKey] = [request(true, account), request('by key', account)]
    const root = await systemTree(bySession)
    const kept = await value(
      run(bySession, Mapping.createTile({ parent: root.id, slot: 1, ...content('Kept') })),
    )
    const open = await value(
      run(bySession, Mapping.createTile({ parent: root.id, slot: 2, ...content('Open') })),
    )
    const everyone = { subject: 'everyone', subjectId: null, value: 'read' } as const
    await value(run(bySession, transactional(granted(account.id, { tile: open.id, ...everyone }))))
    // Under Open, Kept would be read by Everyone, which its star keeps it from.
    const opening = Mapping.moveTile({ id: kept.id, version: 1, parent: open.id, slot: 1 })
    expect(await run(byKey, opening)).toMatchObject({
      ok: false,
      failure: { _tag: 'NotAllowed', kind: 'Forbidden' },
    })
    expect(await run(bySession, opening)).toMatchObject({ ok: true })
  })
})
