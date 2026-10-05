import { Exit, Option } from 'effect'
import { describe, expect, expectTypeOf, it } from 'vitest'

import type { SignedOut } from '#/domains/iam/errors'
import type { TileNotFound } from '#/domains/mapping/errors'
import { exportOf } from '#/domains/mapping/files/files'
import { unzipped } from '#/repositories/zip/zip'

import type { Unexpected } from '../errors/failure'
import { noKey, run, type StartContext } from '../server/run'
import { asDownload, downloaded, type ExportAnswer, tileLink } from './download'
import type { exportTile } from './mapping'
import * as Mapping from './programs'

// An export, from the program to the file the browser saves: the program through the helper, on the
// runtime's repositories over PGlite, its outcome answered as the server function answers it, then
// read back as the client reads it.

/** A request from someone signed in as an Account no other test uses, or from nobody. */
function request(signedIn = true): StartContext {
  const account = { id: crypto.randomUUID(), email: 'someone@example.com' }
  return {
    requestId: 'req-export',
    scope: 'exportTile',
    waitUntil: () => undefined,
    exchange: {
      url: 'https://hexframe.test/_serverFn/export',
      headers: new Headers(),
      setCookies: () => undefined,
    },
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

const content = (title: string) => ({ title, preview: `${title}, in short.`, body: `# ${title}` })

/**
 * Someone's System: the Root, named; a Branch holding a Leaf; a Context Tile; and a Reference from the
 * Branch's Context to the Context Tile.
 */
async function aSystem() {
  const context = request()
  const { id: root } = await value(run(context, Mapping.system))
  await value(run(context, Mapping.editTile({ id: root, title: 'Ulysse Boillot' })))
  const branch = await value(
    run(context, Mapping.createTile({ parent: root, slot: 1, ...content('Games') })),
  )
  await value(
    run(context, Mapping.createTile({ parent: branch.id, slot: { leaf: 2 }, ...content('Notes') })),
  )
  const principles = await value(
    run(context, Mapping.createTile({ parent: root, slot: -1, ...content('Principles') })),
  )
  await value(
    run(context, Mapping.createReference({ parent: branch.id, slot: -3, target: principles.id })),
  )
  return { context, root, branch }
}

/** The export of this Tile, answered as the server function answers it. */
async function answered(context: StartContext, id: string) {
  return asDownload(await run(context, Mapping.exportTile({ id })))
}

describe('a Tile exported as a zip', () => {
  it('holds exactly the files the serializer writes for it, the whole System from the Root', async () => {
    const { context, root, branch } = await aSystem()
    const system = await value(run(context, Mapping.system))
    for (const id of [root, branch.id]) {
      const answer = await answered(context, id)
      if (!(answer instanceof Response)) throw new Error('Expected a download')
      const archive = new Uint8Array(await answer.arrayBuffer())
      const files = exportOf(system, id, tileLink(context.exchange.url))?.files
      expect(unzipped(archive)).toEqual(files)
    }
  })

  it('downloads as `<slug>.zip`, an attachment no cache keeps', async () => {
    const { context, root, branch } = await aSystem()
    const answer = await answered(context, root)
    if (!(answer instanceof Response)) throw new Error('Expected a download')
    expect(answer.headers.get('content-type')).toBe('application/zip')
    expect(answer.headers.get('content-disposition')).toBe(
      'attachment; filename="ulysse-boillot.zip"',
    )
    expect(answer.headers.get('cache-control')).toBe('no-store')
    const saved = await value(downloaded(await answered(context, branch.id)))
    expect(saved.name).toBe('games.zip')
    expect(unzipped(new Uint8Array(await saved.blob.arrayBuffer())).length).toBeGreaterThan(0)
  })

  it('links a Reference whose Tile is left out on the site the request reached', async () => {
    const { context, branch } = await aSystem()
    const answer = await answered(context, branch.id)
    if (!(answer instanceof Response)) throw new Error('Expected a download')
    const files = unzipped(new Uint8Array(await answer.arrayBuffer()))
    const reference = files.find(({ path }) => path.startsWith('.3-'))
    expect(reference?.content).toMatch(/reference: https:\/\/hexframe\.test\/\?center=[0-9a-f-]+\n/)
  })

  it("answers TileNotFound for another Account's Tile, as for one that never was", async () => {
    const { root } = await aSystem()
    const refused = { ok: false, failure: { _tag: 'TileNotFound', kind: 'NotFound' } }
    expect(await answered(request(), root)).toMatchObject(refused)
    expect(await answered(request(), crypto.randomUUID())).toMatchObject(refused)
  })

  it('sends SignedOut to nobody, and the client gets the failure back as it came', async () => {
    const answer = await answered(request(false), crypto.randomUUID())
    const failure = {
      ok: false,
      failure: { _tag: 'SignedOut', kind: 'Unauthenticated' },
      requestId: 'req-export',
    }
    expect(answer).toEqual(failure)
    expect(await downloaded(answer)).toEqual(failure)
  })

  it('lists the errors it can fail with by its type', () => {
    expectTypeOf<Awaited<ReturnType<typeof exportTile>>>().toEqualTypeOf<
      ExportAnswer<SignedOut | TileNotFound | Unexpected>
    >()
  })
})
