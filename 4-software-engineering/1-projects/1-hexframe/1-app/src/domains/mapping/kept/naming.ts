// The naming in force at a Tile of a System: what its own Tile config sets, else the nearest Tile
// above that sets it, else the defaults, part by part. Pure: an export names its files by it.
import type { SystemTile } from '../system'
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

/** A Context slot holding a Tile of its own, rather than a Reference. */
const isTile = (held: SystemTile['context'][-1]): held is SystemTile => held?._tag === 'Tile'

/**
 * The naming in force at the Tile of this id, below `tile` (the Root of a System, whose naming starts
 * from the defaults); `undefined` when no Tile of this id stands there.
 */
export function namingOf(tile: SystemTile, id: string, above = defaultNaming): Naming | undefined {
  const naming = inherited(above, tile)
  if (tile.id === id) return naming
  const leaf = Object.values(tile.leaves).find((found) => found.id === id)
  if (leaf !== undefined) return inherited(naming, leaf)
  const below = [...Object.values(tile.branches), ...Object.values(tile.context).filter(isTile)]
  for (const next of below) {
    const found = namingOf(next, id, naming)
    if (found !== undefined) return found
  }
  return undefined
}
