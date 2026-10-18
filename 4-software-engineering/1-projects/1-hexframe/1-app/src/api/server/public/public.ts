// `/t/<id>.md`, a public Tile as Markdown: a door of its own, for anyone holding the link, signed in
// or not, an LLM fetching a URL among them (HEX-129). It proves nothing and passes on nothing of the
// request but where it was sent, never a cookie nor a header, so it reads as anyone would: the Tile
// Everyone may read, opened as the MCP's `open_tile` opens one (`publicTile`), written by
// `markdownOf`. A Tile Everyone may not read answers the same 404 as one that doesn't exist; no page
// it answers is indexed, nor kept by a cache, so a Grant removed holds from the next fetch.
import { Schema } from 'effect'

import { ShippedId, TileId } from '#/domains/mapping/entities'

import { publicTile } from '../../mapping/programs'
import { noKey, noSession, run, waitUntilOf, type StartContext } from '../run'
import { markdownOf } from './markdown'

/** What every answer of the door carries: never indexed, never kept. */
const unkept = { 'x-robots-tag': 'noindex', 'cache-control': 'no-store' }

/** The answer for a Tile no one may be shown here: kept from Everyone, or none at all. */
const notFound = () =>
  new Response('Not found\n', {
    status: 404,
    headers: { ...unkept, 'content-type': 'text/plain; charset=utf-8' },
  })

/** Whether an id names a Tile at all: a UUID, or the id of a Tile hexframe ships (HEX-139). */
const isTileId = Schema.is(Schema.Union([TileId, ShippedId]))

/** The link a Tile's Markdown is read by, on the site the request reached. */
export const markdownLink = (url: string) => (id: string) =>
  new URL(`/t/${encodeURIComponent(id)}.md`, url).href

/**
 * Serves `/t/<id>.md`: the Tile of this id as Markdown when Everyone may read it, its Children and
 * Context linked the same way; a 404 for an id that is no Tile's, or one Everyone may not read; a 500,
 * with the request id, for anything else.
 */
export async function servePublicTile(request: Request, id: string): Promise<Response> {
  if (!isTileId(id)) return notFound()
  const context: StartContext = {
    requestId: crypto.randomUUID(),
    scope: 'publicTile',
    waitUntil: waitUntilOf(request),
    exchange: { url: request.url, headers: new Headers(), setCookies: () => undefined },
    session: noSession,
    key: noKey,
  }
  const outcome = await run(context, publicTile({ tile: id }))
  if (outcome.ok) {
    return new Response(markdownOf(outcome.value, markdownLink(request.url)), {
      headers: { ...unkept, 'content-type': 'text/markdown; charset=utf-8' },
    })
  }
  if (outcome.failure.kind === 'NotFound') return notFound()
  return new Response(`Something went wrong (request ${outcome.requestId})\n`, {
    status: 500,
    headers: { ...unkept, 'content-type': 'text/plain; charset=utf-8' },
  })
}

/** Anything but GET: the door only reads. */
export const methodNotAllowed = () => new Response(null, { status: 405, headers: { allow: 'GET' } })
