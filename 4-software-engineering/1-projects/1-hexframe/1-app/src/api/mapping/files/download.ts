// An export as it crosses the wire, on both sides. A server function's answer is an object, which
// Start serializes, or a raw `Response`, which Start hands to the client untouched (it marks it
// `x-tss-raw`): an export's zip goes as a `Response`, its bytes streamed as they are zipped, so it
// never waits whole in the function's memory, and its failure as an object, the `Outcome` every
// server function answers. The client turns the answer back into an `Outcome`, so its channels carry
// the failure as any other (`front/client/`). And where an export links a Tile it leaves out, a route
// of the front's, which the front's own tests read back, and the id an import reads back from such a
// link; and which Leaf an export writes as its content alone, Mapping's rule, which the front's card
// follows. Pure: no module of the server's reaches the client here.
import type { Failure, Outcome } from '../../report/errors/failure'

/**
 * Whether an export writes a Leaf as its content alone, a file that isn't Markdown, under its Name:
 * Mapping's rule, so the System's card shows that Leaf's Body as code exactly when its file is code.
 */
export { isVerbatim } from '#/domains/mapping/files/names'

/** A zip as Mapping hands it over: its name, `<slug>.zip`, and its bytes, streamed. */
interface Zipped {
  readonly name: string
  readonly bytes: ReadableStream<Uint8Array>
}

/** A file the browser saves: its name and its bytes. */
export interface Download {
  readonly name: string
  readonly blob: Blob
}

/** What an export's server function answers: the zip, streamed as a download, or the failure. */
export type ExportAnswer<E extends Failure> = Response | Extract<Outcome<never, E>, { ok: false }>

/**
 * An export's outcome as its server function answers it: the zip as an attachment, under its name,
 * kept by no cache since it is one Account's, or the failure as it came.
 */
export function asDownload<E extends Failure>(outcome: Outcome<Zipped, E>): ExportAnswer<E> {
  if (!outcome.ok) return outcome
  const { name, bytes } = outcome.value
  return new Response(bytes, {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${name}"`,
      'cache-control': 'no-store',
    },
  })
}

/**
 * The name an attachment is saved under, as its `Content-Disposition` gives it: `asDownload` always
 * names one, so an answer that doesn't came from somewhere else, and fails the call.
 */
function nameOf(response: Response): string {
  const name = /filename="([^"]+)"/.exec(response.headers.get('content-disposition') ?? '')?.[1]
  if (name === undefined) throw new Error('A download came without its file name')
  return name
}

/** An export's answer, as the client receives it, as an outcome: the file to save, or the failure. */
export async function downloaded<E extends Failure>(
  answer: ExportAnswer<E>,
): Promise<Outcome<Download, E>> {
  if (!(answer instanceof Response)) return answer
  return { ok: true, value: { name: nameOf(answer), blob: await answer.blob() } }
}

/**
 * Where the app shows a Tile, by its id, on the site a request reached: home, centered on it, as the
 * System's page reads its search params (`front/features/system/search/search.ts`, whose test reads
 * this link back). An export links by it a Reference whose Tile it leaves out.
 */
export const tileLink =
  (requestUrl: string) =>
  (id: string): string =>
    new URL(`/?center=${encodeURIComponent(id)}`, requestUrl).href

/**
 * The id of the Tile a link points at, when `tileLink` would have built it on the site a request
 * reached: home, centered on it; `undefined` for any other text. An import reads a Reference's link
 * by it, and lands it only on a Tile of the importer's own System.
 */
export const tileOfLink =
  (requestUrl: string) =>
  (link: string): string | undefined => {
    if (!URL.canParse(link)) return undefined
    const url = new URL(link)
    const home = new URL('/', requestUrl)
    const center = url.searchParams.get('center')
    const plain = url.origin === home.origin && url.pathname === home.pathname
    return plain && center !== null && center !== '' ? center : undefined
  }
