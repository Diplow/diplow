// The tutorial's center's body and its ring shown as the same six (HEX-122), while its rules say so:
// its six landing one by one, each lighting the line of the body that names it, the agent's few
// words then, and a line pointed at in the chat, or a tile on the canvas, lighting both, the tile
// and its line; a line clicked or tapped shows its tile, which a phone brings forward for a glance.
import { useMemo, useState } from 'react'

import { useAround } from '#/front/ui/motion'
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
 * The same six as home plays them, from the start each time its rules show them anew: the six
 * landing and the agent's words on one clock (`useAround`), and the tile pointed at, from either
 * side, let go once they are no longer shown.
 */
export function useSameSix({ tree, body, shown, onShow }: SameSixInput): Partial<SameSix> {
  const ring = useMemo(
    () => (tree === undefined || body === undefined ? undefined : ringOf(tree, body)),
    [tree, body],
  )
  const on = shown && ring !== undefined
  const around = useAround(on)
  const [pointed, setPointed] = useState<string>()
  // A tile pointed at while the six showed is let go with them, so none is lit when they come back.
  const [wasOn, setWasOn] = useState(on)
  if (wasOn !== on) {
    setWasOn(on)
    setPointed(undefined)
  }
  if (!shown || ring === undefined || tree === undefined) return {}
  return sameSixOf(ring, {
    around,
    pointed,
    setPointed,
    onShow: (tile) => {
      onShow(findTile(tree, tile)?.title ?? tile)
    },
  })
}
