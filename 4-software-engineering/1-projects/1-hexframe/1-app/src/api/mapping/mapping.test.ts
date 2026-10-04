import { Effect, Exit, Option, Schema } from 'effect'
import { describe, expect, expectTypeOf, it } from 'vitest'

import type { SignedOut } from '#/domains/iam/errors'
import type { KeyProof, Session } from '#/domains/iam/iam'
import type {
  DirectionTaken,
  MovedUnderItself,
  PreviewTooLong,
  RootFixed,
  TileNotFound,
  TitleMissing,
} from '#/domains/mapping/errors'

import type { Failure } from '../errors/failure'
import { noKey, run, type Services, type StartContext } from '../server/run'
import { NewReference, NewTile, ReferenceSlot, TileEdit, TileMove, TileRef } from './mapping'
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

/** Someone's System, read once so its Root exists, with a Child of the Root in Direction 1. */
async function withAChild() {
  const context = request()
  const root = await value(run(context, Mapping.system))
  const child = await value(
    run(context, Mapping.createTile({ parent: root.id, slot: 1, ...content('Child') })),
  )
  return { context, root, child }
}

describe("Mapping's server functions", () => {
  it.each<readonly [string, Program]>([
    ['system', Mapping.system],
    ['createTile', Mapping.createTile({ parent: 'p', slot: 1, ...content('Child') })],
    ['editTile', Mapping.editTile({ id: 't', title: 'Renamed' })],
    ['moveTile', Mapping.moveTile({ id: 't', parent: 'p', slot: 2 })],
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

  it('runs for an Account its Key proves as for one its Session proves', async () => {
    const context = request('by key')
    const root = await value(run(context, Mapping.system))
    await value(run(context, Mapping.createTile({ parent: root.id, slot: 1, ...content('Child') })))
    expect((await value(run(context, Mapping.system))).children[1]).toMatchObject(content('Child'))
  })

  it("reads the Account's System, its Root added untitled on the first read", async () => {
    const context = request()
    const first = await value(run(context, Mapping.system))
    expect(first).toMatchObject({ _tag: 'Tile', title: '', children: {}, context: {} })
    expect((await value(run(context, Mapping.system))).id).toBe(first.id)
  })

  it('creates, edits, moves and deletes a Tile, and the System reads them back', async () => {
    const { context, root, child } = await withAChild()
    expect(child).toEqual({ id: child.id, ...content('Child') })

    const edited = await value(run(context, Mapping.editTile({ id: child.id, title: ' Renamed ' })))
    expect(edited).toEqual({ ...child, title: 'Renamed' })

    await value(run(context, Mapping.moveTile({ id: child.id, parent: root.id, slot: 4 })))
    const { children } = await value(run(context, Mapping.system))
    expect(Object.keys(children)).toEqual(['4'])
    expect(children[4]).toMatchObject({ id: child.id, title: 'Renamed' })

    await value(run(context, Mapping.deleteTile({ id: child.id })))
    expect((await value(run(context, Mapping.system))).children).toEqual({})
  })

  it('puts a Reference in a Context slot and empties it', async () => {
    const { context, root, child } = await withAChild()
    await value(
      run(context, Mapping.createReference({ parent: root.id, slot: -2, target: child.id })),
    )
    expect((await value(run(context, Mapping.system))).context).toEqual({
      [-2]: { _tag: 'Reference', tile: child },
    })

    await value(run(context, Mapping.deleteReference({ parent: root.id, slot: -2 })))
    expect((await value(run(context, Mapping.system))).context).toEqual({})
  })

  it('sends a refusal as its tagged error, with its kind and the request id', async () => {
    const { context, root, child } = await withAChild()
    const refusals: ReadonlyArray<readonly [Program, string]> = [
      [Mapping.createTile({ parent: root.id, slot: 1, ...content('Another') }), 'DirectionTaken'],
      [Mapping.moveTile({ id: root.id, parent: child.id, slot: 1 }), 'RootFixed'],
      [Mapping.deleteTile({ id: root.id }), 'RootFixed'],
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
    const theirRoot = await value(run(stranger, Mapping.system))
    expect(theirRoot.children).toEqual({})
    const attempts: ReadonlyArray<Program> = [
      Mapping.editTile({ id: child.id, title: 'Mine now' }),
      Mapping.moveTile({ id: child.id, parent: theirRoot.id, slot: 1 }),
      Mapping.deleteTile({ id: child.id }),
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

  it('lists, by its type, the errors each can fail with', () => {
    type ErrorOf<P> = P extends Effect.Effect<unknown, infer E, unknown> ? E : never
    expectTypeOf<ErrorOf<typeof Mapping.system>>().toEqualTypeOf<SignedOut>()
    expectTypeOf<ErrorOf<ReturnType<typeof Mapping.createTile>>>().toEqualTypeOf<
      SignedOut | TitleMissing | PreviewTooLong | TileNotFound | DirectionTaken
    >()
    expectTypeOf<ErrorOf<ReturnType<typeof Mapping.editTile>>>().toEqualTypeOf<
      SignedOut | TitleMissing | PreviewTooLong | TileNotFound
    >()
    expectTypeOf<ErrorOf<ReturnType<typeof Mapping.moveTile>>>().toEqualTypeOf<
      SignedOut | TileNotFound | RootFixed | MovedUnderItself | DirectionTaken
    >()
    expectTypeOf<ErrorOf<ReturnType<typeof Mapping.deleteTile>>>().toEqualTypeOf<
      SignedOut | TileNotFound | RootFixed
    >()
    expectTypeOf<ErrorOf<ReturnType<typeof Mapping.createReference>>>().toEqualTypeOf<
      SignedOut | TileNotFound | DirectionTaken
    >()
    expectTypeOf<ErrorOf<ReturnType<typeof Mapping.deleteReference>>>().toEqualTypeOf<
      SignedOut | TileNotFound
    >()
  })
})

describe("the schemas Mapping's server functions validate by", () => {
  const accepts = (schema: Schema.Top, input: unknown) => Schema.is(schema)(input)
  const p = crypto.randomUUID()
  const t = crypto.randomUUID()

  it('take a Child in Directions 1 to 6 and a Context slot in -1 to -6, nothing else', () => {
    const at = (slot: number) => ({ parent: p, slot, ...content('Tile') })
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
  })

  it('put a Reference in a Context slot only', () => {
    expect(accepts(NewReference, { parent: p, slot: -3, target: t })).toBe(true)
    expect(accepts(NewReference, { parent: p, slot: 3, target: t })).toBe(false)
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
    expect(['', 't', 'x'.repeat(36), `${t}x`].map((id) => accepts(TileRef, { id }))).toEqual([
      false,
      false,
      false,
      false,
    ])
    expect(accepts(NewReference, { parent: p, slot: -1, target: 'root' })).toBe(false)
  })
})
