import { Effect, Exit, Option, Result, Schema } from 'effect'
import { describe, expect, expectTypeOf, it } from 'vitest'

import type { SignedOut } from '#/domains/iam/errors'
import type {
  DirectionTaken,
  HelpReadOnly,
  ImportRefused,
  LeafHoldsNothing,
  TileNotFound,
} from '#/domains/mapping/errors'
import { uploadLimit } from '#/domains/mapping/landing/landing'
import { archiveOf } from '#/repositories/zip/testing'

import { noKey, run, type StartContext } from '../../server/run'
import { tileLink, tileOfLink } from './download'
import { ImportUpload } from '../mapping'
import * as Mapping from '../programs'

// An import as it crosses the wire: a form encoded by the server function's schema and decoded back,
// as Start hands it to the handler, then the program through the helper, on the runtime's
// repositories over PGlite. Its size refused before anything else, its links read on the request's
// site, its refusals with every fault.

const site = 'https://hexframe.test/_serverFn/import'

/** A request from someone signed in as an Account no other test uses, or from nobody. */
function request(signedIn = true): StartContext {
  const account = { id: crypto.randomUUID(), email: 'someone@example.com' }
  return {
    requestId: 'req-import',
    scope: 'importTiles',
    waitUntil: () => undefined,
    exchange: { url: site, headers: new Headers(), setCookies: () => undefined },
    session: Exit.succeed(
      signedIn ? Option.some({ account, expiresAt: new Date(Date.now() + 60_000) }) : Option.none(),
    ),
    key: noKey,
  }
}

/** The value of a call that must succeed. */
async function value<A>(outcome: Promise<{ ok: true; value: A } | { ok: false }>): Promise<A> {
  const settled = await outcome
  if (!settled.ok) throw new Error(`Expected a success, got ${JSON.stringify(settled)}`)
  return settled.value
}

type Upload = typeof ImportUpload.Type

/** An upload as the client's form sends it and the handler receives it: encoded, then decoded. */
const overTheWire = (upload: Upload): Upload =>
  Schema.decodeUnknownSync(ImportUpload)(Schema.encodeSync(ImportUpload)(upload))

/** A zip of these files, uploaded under `name`. */
const zipOf = (files: Readonly<Record<string, string>>, name = 'vault.zip') =>
  // A copy, which owns a plain ArrayBuffer, as a File's parts must.
  new File([archiveOf(files).slice()], name)

/** Someone signed in, their System read once so its Root exists. */
async function someone() {
  const context = request()
  const root = await value(run(context, Mapping.system))
  return { context, root }
}

describe('an import, over the wire', () => {
  it('lands an uploaded zip in a free slot and answers what it created and skipped', async () => {
    const { context, root } = await someone()
    const upload = overTheWire({
      upload: zipOf({ 'CLAUDE.md': '---\ntitle: Vault\n---\n', '1-a/CLAUDE.md': '', '.x': 'x' }),
      as: 'Zip',
      place: { _tag: 'Slot', parent: root.id, slot: 2 },
    })
    const report = await value(run(context, Mapping.importTiles(upload)))
    expect(report).toEqual({
      id: report.id,
      tiles: 2,
      references: 0,
      skipped: [{ path: '.x', reason: 'DotFile' }],
    })
    const system = await value(run(context, Mapping.system))
    expect(system.branches[2]).toMatchObject({ id: report.id, title: 'Vault', name: 'vault' })
    expect(system.branches[2]?.branches[1]).toMatchObject({ title: 'A' })
  })

  it('lands one file alone as the Root of an empty System', async () => {
    const context = request()
    const upload = overTheWire({
      upload: new File(['---\ntitle: Ulysse\npreview: Me.\n---\n\nHello.\n'], 'me.md'),
      as: 'File',
      place: { _tag: 'Root' },
    })
    const report = await value(run(context, Mapping.importTiles(upload)))
    const system = await value(run(context, Mapping.system))
    expect(system).toMatchObject({ id: report.id, title: 'Ulysse', preview: 'Me.' })
  })

  it('refuses an upload past 4 MB before anything else, signed out or not, reading none of it', async () => {
    const big = new File([new Uint8Array(uploadLimit + 1)], 'big.zip')
    // Its bytes are never read: the refusal comes from its size alone.
    big.arrayBuffer = () => Promise.reject(new Error('An upload past its limit was read'))
    const upload = { upload: big, as: 'Zip', place: { _tag: 'Root' } } as const
    const refused = {
      ok: false,
      failure: {
        _tag: 'ImportRefused',
        kind: 'Invalid',
        fields: ['files'],
        faults: [{ path: '', fault: 'UploadTooLarge' }],
      },
    }
    for (const signedIn of [true, false]) {
      expect(await run(request(signedIn), Mapping.importTiles(upload))).toMatchObject(refused)
    }
    const fits = new File([new Uint8Array(uploadLimit)], 'fits.zip')
    expect(await run(request(), Mapping.importTiles({ ...upload, upload: fits }))).toMatchObject({
      ok: false,
      failure: { faults: [{ path: '', fault: 'ArchiveUnreadable' }] },
    })
  })

  it('sends every fault at once, and writes nothing', async () => {
    const { context, root } = await someone()
    const upload = {
      upload: zipOf({ 'CLAUDE.md': '', 'a.md': 'a', 'A.md': 'A', '../up.md': 'up' }),
      as: 'Zip',
      place: { _tag: 'Slot', parent: root.id, slot: 1 },
    } as const
    expect(await run(context, Mapping.importTiles(upload))).toMatchObject({
      ok: false,
      failure: {
        _tag: 'ImportRefused',
        faults: [
          { path: 'A.md', fault: 'PathsClash' },
          { path: '../up.md', fault: 'DotSegment' },
        ],
      },
      requestId: 'req-import',
    })
    expect(await value(run(context, Mapping.system))).toMatchObject({ branches: {}, leaves: {} })
  })

  it("resolves a Reference's link on the request's site to this System's Tile, and no other", async () => {
    const { context, root } = await someone()
    const reference = (link: string) => `---\ntitle: Ref\nreference: ${link}\n---\n`
    const upload = {
      upload: zipOf({
        'CLAUDE.md': '',
        '.1-here/CLAUDE.md': reference(tileLink(site)(root.id)),
        '.2-elsewhere/CLAUDE.md': reference(tileLink('https://elsewhere.test/')(root.id)),
      }),
      as: 'Zip',
      place: { _tag: 'Slot', parent: root.id, slot: 1 },
    } as const
    await value(run(context, Mapping.importTiles(upload)))
    const context_ = (await value(run(context, Mapping.system))).branches[1]?.context
    expect(context_?.[-1]).toMatchObject({ _tag: 'Reference', tile: { id: root.id } })
    expect(context_?.[-2]).toMatchObject({ _tag: 'BrokenReference' })
  })

  it('sends SignedOut to nobody', async () => {
    const upload = {
      upload: zipOf({ 'CLAUDE.md': '' }),
      as: 'Zip',
      place: { _tag: 'Root' },
    } as const
    expect(await run(request(false), Mapping.importTiles(upload))).toMatchObject({
      ok: false,
      failure: { _tag: 'SignedOut', kind: 'Unauthenticated' },
    })
  })

  it('lists the errors it can fail with by its type', () => {
    type ErrorOf<P> = P extends Effect.Effect<unknown, infer E, unknown> ? E : never
    expectTypeOf<ErrorOf<ReturnType<typeof Mapping.importTiles>>>().toEqualTypeOf<
      ImportRefused | SignedOut | TileNotFound | DirectionTaken | LeafHoldsNothing | HelpReadOnly
    >()
  })
})

describe('the link an import reads back as a Tile', () => {
  const id = crypto.randomUUID()

  it('is the link an export writes, home centered on it, on the site the request reached', () => {
    expect(tileOfLink(site)(tileLink(site)(id))).toBe(id)
  })

  it('is no Tile on another site, another page, without a center, or not a link at all', () => {
    const elsewhere = [
      tileLink('https://elsewhere.test/')(id),
      `https://hexframe.test/help?center=${id}`,
      'https://hexframe.test/?center=',
      'https://hexframe.test/',
      '[[1-games/CLAUDE]]',
      'just text',
    ]
    expect(elsewhere.map(tileOfLink(site))).toEqual(elsewhere.map(() => undefined))
  })
})

describe('the schema an import validates by', () => {
  const accepts = (input: unknown) =>
    Result.isSuccess(Schema.decodeUnknownResult(ImportUpload)(input))
  const form = (fields: Readonly<Record<string, string | File>>) => {
    const data = new FormData()
    for (const [key, field] of Object.entries(fields)) data.append(key, field)
    return data
  }
  const upload = new File(['x'], 'x.zip')
  const place = (value: unknown) => JSON.stringify(value)
  const parent = crypto.randomUUID()

  it('takes a file, a zip or one alone, and a slot under a Tile or the Root', () => {
    for (const slot of [1, -6, { leaf: 3 }]) {
      expect(
        accepts(form({ upload, as: 'Zip', place: place({ _tag: 'Slot', parent, slot }) })),
      ).toBe(true)
    }
    expect(accepts(form({ upload, as: 'File', place: place({ _tag: 'Root' }) }))).toBe(true)
  })

  it('refuses no file, another kind, a slot out of range, a parent no UUID, a place no JSON', () => {
    const slot = (value: unknown) => place({ _tag: 'Slot', parent, slot: value })
    expect(
      [
        form({ upload: 'not a file', as: 'Zip', place: place({ _tag: 'Root' }) }),
        form({ upload, as: 'Folder', place: place({ _tag: 'Root' }) }),
        form({ upload, as: 'Zip', place: slot(7) }),
        form({ upload, as: 'Zip', place: place({ _tag: 'Slot', parent: 'help/1', slot: 1 }) }),
        form({ upload, as: 'Zip', place: 'Root' }),
        { upload, as: 'Zip', place: { _tag: 'Root' } },
      ].map(accepts),
    ).toEqual([false, false, false, false, false, false])
  })
})
