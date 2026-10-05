// What the tests read an archive back with: whole, trusting it, since they read only archives the app
// wrote. An import reads archives a user sends, so it brings its own reader, bounded as it inflates.
import { strFromU8, unzipSync } from 'fflate'

import type { Entry } from './zip'

/** An archive's files, read back whole, in the order it holds them; a folder's own entry left out. */
export function unzipped(archive: Uint8Array): ReadonlyArray<Entry> {
  return Object.entries(unzipSync(archive))
    .filter(([path]) => !path.endsWith('/'))
    .map(([path, bytes]) => ({ path, content: strFromU8(bytes) }))
}
