// A tile's body and its ring as the same six (HEX-122): each numbered line of its body names the
// Child in the Direction its number says, so the list read in the chat is the ring seen on the
// canvas. A line whose number is no Direction, or one holding no Child, names nothing; nor does a
// Tile no line numbers. And what the chat takes of it, as home and the onboarding slide play it.
// Pure.
import { directions } from '#/domains/mapping/entities'
import type { ToldSix } from '#/front/ui/chat/text/Message'
import { blocksOf } from '#/front/ui/chat/text/words'
import type { AroundPart } from '#/front/ui/motion'
import type { TileNode } from '#/front/ui/canvas/view/tiles'

/** A tile's body's numbered lines and the Children around it, each the other's. */
export interface Ring {
  /** The Child a line names, by the number written before it; none for a line that names none. */
  tileOf: (line: number) => string | undefined
  /** The line that names a Child, by its id; none for a Tile no line names. */
  lineOf: (tile: string) => number | undefined
}

/**
 * The numbered lines of `body`, the tile's own, each tied to the Child of `tile` in the Direction its
 * number says, as Markdown numbers a list (`blocksOf`): the first line to name a Child keeps it.
 */
export function ringOf(tile: TileNode, body: string): Ring {
  const named = new Map<number, string>()
  for (const block of blocksOf([body])) {
    if (!('list' in block)) continue
    for (const { number } of block.list) {
      const line = Number(number)
      const child = childAt(tile, line)
      if (child !== undefined && !named.has(line)) named.set(line, child.id)
    }
  }
  const lines = new Map([...named].map(([line, id]) => [id, line]))
  return { tileOf: (line) => named.get(line), lineOf: (id) => lines.get(id) }
}

/** The Child of `tile` in the Direction `line` says, a Branch or a Leaf; none for no Direction. */
function childAt(tile: TileNode, line: number): TileNode | undefined {
  const direction = directions.find((each) => each === line)
  if (direction === undefined) return undefined
  return tile.branches?.[direction] ?? tile.leaves?.[direction]
}

/**
 * The tile pointed at once `tile` is pointed at, or let go: letting go of another than the one
 * pointed at leaves it, as a card shutting after the next one opened does.
 */
function pointedAfter(current: string | undefined, tile: string, pointing: boolean) {
  if (pointing) return tile
  return current === tile ? undefined : current
}

/** The same six as they play: the six landing, the agent's words, and the tile pointed at. */
export interface SixPlaying {
  /** How many of the six landed while lit, and what the agent said of them (`useAround`). */
  around: { landed: number; said: AroundPart | undefined }
  /** The tile of the ring pointed at, from its line or on the canvas; none while none is. */
  pointed: string | undefined
  /** Where the tile pointed at is kept, as a state's setter keeps it. */
  setPointed: (next: (current: string | undefined) => string | undefined) => void
  /** A tile shown, its line clicked or tapped, which a phone brings forward. */
  onShow: (tile: string) => void
}

/** What the canvas and the chat each take of the same six. */
export interface SameSix {
  /** The tile of the ring pointed at, lit on the canvas; none while none is. */
  pointed: string | undefined
  /** A tile pointed at on the canvas, or let go: one the body names no line for, the center's, lights nothing. */
  onPoint: (tile: string, pointing: boolean) => void
  /** The chat's: what the agent says, what landed, and each line naming a tile. */
  six: ToldSix
}

/**
 * The same six as the canvas and the chat take them: the tile of the ring pointed at, from either
 * side, lit on both, the body's lines that name a tile of the ring, and a line pointed at, or shown,
 * pointing at its tile.
 */
export function sameSixOf(ring: Ring, playing: SixPlaying): SameSix {
  const { around, pointed, setPointed, onShow } = playing
  const onPoint = (tile: string, pointing: boolean) => {
    if (ring.lineOf(tile) === undefined) return
    setPointed((current) => pointedAfter(current, tile, pointing))
  }
  const onLine = (line: number, does: (tile: string) => void) => {
    const tile = ring.tileOf(line)
    if (tile !== undefined) does(tile)
  }
  return {
    pointed,
    onPoint,
    six: {
      ...around,
      pointed: pointed === undefined ? undefined : ring.lineOf(pointed),
      names: (line) => ring.tileOf(line) !== undefined,
      onPoint: (line, pointing) => {
        onLine(line, (tile) => {
          onPoint(tile, pointing)
        })
      },
      onShow: (line) => {
        onLine(line, (tile) => {
          onPoint(tile, true)
          onShow(tile)
        })
      },
    },
  }
}
