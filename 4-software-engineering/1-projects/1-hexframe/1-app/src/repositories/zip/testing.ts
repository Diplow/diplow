// What the tests read an archive back with, and make one with: whole, trusting it, since they read
// only archives the app wrote, and write archives for an import to read. An import reads archives a
// user sends, so it brings its own reader, bounded as it inflates (./unzip.ts).
import { strFromU8, unzipSync, zipSync } from 'fflate'

import type { Entry } from './zip'

/** An archive's files, read back whole, in the order it holds them; a folder's own entry left out. */
export function unzipped(archive: Uint8Array): ReadonlyArray<Entry> {
  return Object.entries(unzipSync(archive))
    .filter(([path]) => !path.endsWith('/'))
    .map(([path, bytes]) => ({ path, content: strFromU8(bytes) }))
}

/** An archive holding these files, by their paths, in this order, text in UTF-8, whole in memory. */
export function archiveOf(files: Readonly<Record<string, string | Uint8Array>>): Uint8Array {
  return zipSync(
    Object.fromEntries(
      Object.entries(files).map(([path, content]) => [
        path,
        typeof content === 'string' ? new TextEncoder().encode(content) : content,
      ]),
    ),
  )
}
