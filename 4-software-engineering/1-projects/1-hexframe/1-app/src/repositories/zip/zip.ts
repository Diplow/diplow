// Zip archives, over fflate, the one module that imports it (dependency-cruiser.config.ts, `sdks`): a
// list of files streamed into an archive, one file deflated each time the reader asks for more, and an
// archive read back into its files. It speaks paths and bytes; Mapping decides which files an export
// holds (src/domains/mapping/files/).
import { Context, Layer } from 'effect'
import { Zip as Archive, ZipDeflate, strFromU8, strToU8, unzipSync } from 'fflate'

/** One file of an archive: its path from the archive's root, and its text. */
export interface Entry {
  readonly path: string
  readonly content: string
}

/**
 * These files zipped, as a stream of the archive's bytes. A file is deflated only when the reader asks
 * for more, so the archive is never whole in memory, and a response that sends it streams. Each path
 * is written in UTF-8, as fflate flags any that isn't plain ASCII.
 */
export function zipped(entries: ReadonlyArray<Entry>): ReadableStream<Uint8Array> {
  let next = 0
  let archive: Archive | undefined
  let chunks = 0
  return new ReadableStream<Uint8Array>({
    start(controller) {
      archive = new Archive((error, chunk, final) => {
        if (error !== null) {
          controller.error(error)
          return
        }
        chunks += 1
        controller.enqueue(chunk)
        if (final) controller.close()
      })
    },
    pull() {
      if (archive === undefined) return
      // A pull that enqueues nothing would never be called again: add files until one writes bytes.
      const before = chunks
      while (chunks === before) {
        const entry = entries[next]
        next += 1
        if (entry === undefined) {
          archive.end()
          return
        }
        const file = new ZipDeflate(entry.path)
        archive.add(file)
        file.push(strToU8(entry.content), true)
      }
    },
    cancel() {
      archive?.terminate()
    },
  })
}

/** An archive's files, read back whole, in the order it holds them; a folder's own entry left out. */
export function unzipped(archive: Uint8Array): ReadonlyArray<Entry> {
  return Object.entries(unzipSync(archive))
    .filter(([path]) => !path.endsWith('/'))
    .map(([path, bytes]) => ({ path, content: strFromU8(bytes) }))
}

/** Zip, as the server's runtime sees it: a list of files streamed into an archive. */
export class Zip extends Context.Service<Zip, { readonly zipped: typeof zipped }>()('hexframe/Zip') {}

/** Zip over fflate. */
export const layer = Layer.succeed(Zip, { zipped })
