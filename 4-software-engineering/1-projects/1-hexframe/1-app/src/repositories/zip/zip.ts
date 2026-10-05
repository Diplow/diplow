// Zip archives, over fflate, imported by this folder only (dependency-cruiser.config.ts, `sdks`): a
// list of files streamed into an archive, one file deflated each time the reader asks for more; the
// archive a browser uploads, zipped whole; and an archive a user sends unpacked within bounds
// (./unzip.ts). It speaks paths and bytes; Mapping
// decides which files an export holds and what an import's entries may be (src/domains/mapping/).
import { Context, Layer } from 'effect'
import { Zip as Archive, ZipDeflate, strToU8, zipSync } from 'fflate'

import { unpacked } from './unzip'

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

/** One file of an archive a browser writes: its path from the archive's root, and its bytes. */
export interface ArchivedFile {
  readonly path: string
  readonly bytes: Uint8Array
}

/**
 * These files zipped whole, in memory, in their order: what a browser uploads, a few megabytes at most,
 * once it has left out what the server would. A plain function the browser reaches through the API
 * layer (`api/mapping/files/upload.ts`), as it does observability's.
 */
export function archived(files: ReadonlyArray<ArchivedFile>): Uint8Array {
  return zipSync(Object.fromEntries(files.map(({ path, bytes }) => [path, bytes])))
}

/**
 * Zip, as the server's runtime sees it: a list of files streamed into an archive, and an archive
 * unpacked in memory, counted as it inflates.
 */
export class Zip extends Context.Service<
  Zip,
  { readonly zipped: typeof zipped; readonly unpacked: typeof unpacked }
>()('hexframe/Zip') {}

/** Zip over fflate. */
export const layer = Layer.succeed(Zip, { zipped, unpacked })
