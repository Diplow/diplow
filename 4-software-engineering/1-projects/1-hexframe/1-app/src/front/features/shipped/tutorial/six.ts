// The tutorial's center's body and its ring shown as the same six (HEX-122), while its rules say so:
// its six landing one by one, each lighting the line of the body that names it, the agent's few
// words then, and a line pointed at in the chat, or a tile on the canvas, lighting both, the tile
// and its line; a line clicked or tapped shows its tile, which a phone brings forward for a glance.
import { useMemo } from 'react'

import { useSixPlaying } from '#/front/ui/motion'
import { findTile, type TileNode } from '#/front/ui/canvas/view/tiles'

import { ringOf, sameSixOf, type SameSix } from './ring'

interface SameSixInput {
  /** The tutorial's Tiles as the canvas draws them, its center their Root; none until read. */
  tree: TileNode | undefined
  /** Its center's body, whose numbered lines name its six; none until read. */
  body: string | undefined
  /** Whether its rules show its body and its ring as the same six (`sameSix`). */
  shown: boolean
  /** A line clicked or tapped: its tile, by its title, shown, which a phone brings forward. */
  onShow: (title: string) => void
}

/**
 * The same six as home plays them, from the start each time its rules show them anew, on the
 * tutorial's ring (`useSixPlaying`, `sameSixOf`), a line shown naming its tile by its title.
 */
export function useSameSix({ tree, body, shown, onShow }: SameSixInput): SameSix | undefined {
  const ring = useMemo(
    () => (tree === undefined || body === undefined ? undefined : ringOf(tree, body)),
    [tree, body],
  )
  const playing = useSixPlaying(shown && ring !== undefined)
  if (!shown || ring === undefined || tree === undefined) return undefined
  return sameSixOf(ring, playing, (tile) => {
    onShow(findTile(tree, tile)?.title ?? tile)
  })
}
