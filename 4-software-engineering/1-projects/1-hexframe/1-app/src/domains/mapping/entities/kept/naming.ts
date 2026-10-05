// The naming in force at a Tile of a System: what its own Tile config sets, else the nearest Tile
// above that sets it, else the defaults, part by part. Pure: an export names its files by it, and an
// import reads them back by it.
import type { Kept, Naming } from './kept'

/** The naming where no Tile config sets any: a `CLAUDE.md` in each folder, `<n>-<slug>` folders. */
export const defaultNaming: Naming = { fileName: 'CLAUDE.md', folderPattern: '<n>-<slug>' }

/**
 * The naming in force at a Tile, from the naming in force above it: each part its config sets, the
 * others inherited.
 */
export const inherited = (above: Naming, { config }: Kept): Naming => ({
  fileName: config?.fileName ?? above.fileName,
  folderPattern: config?.folderPattern ?? above.folderPattern,
})
