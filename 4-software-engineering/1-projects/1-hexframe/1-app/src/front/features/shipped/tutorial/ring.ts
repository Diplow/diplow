// A tile's body and its ring as the same six (HEX-122): each numbered line of its body names the
// Child in the Direction its number says, so the list read in the chat is the ring seen on the
// canvas. A line whose number is no Direction, or one holding no Child, names nothing; nor does a
// Tile no line numbers. And what the chat takes of it, as home and the onboarding slide play it.
// Pure.
import { directions } from '#/domains/mapping/entities'
import type { PointAt } from '#/front/ui/canvas/Canvas'
import type { ToldSix } from '#/front/ui/chat/text/Message'
import { blocksOf } from '#/front/ui/chat/text/words'
import type { SixPlaying } from '#/front/ui/motion'
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

/** What the canvas and the chat each take of the same six, as they play. */
export interface SameSix {
  /** The tile of the ring pointed at, lit; and a tile pointed at there, the center lighting nothing. */
  canvas: { pointed: string | undefined; onPoint: PointAt }
  /** What the agent says, and the body's lines, each lit as its tile lands or is pointed at. */
  chat: ToldSix
}

/**
 * The same six as the canvas and the chat take them, as they play: the tile of the ring pointed at,
 * from either side, lit on both; the body's lines that name a tile of the ring, each lit once its
 * tile, in its order, has landed, while their landing is lit, or while it is pointed at; and a line
 * pointed at, or shown, pointing at its tile, `onShow` hearing the tile shown, which a phone brings
 * forward.
 */
export function sameSixOf(
  ring: Ring,
  playing: SixPlaying,
  onShow: (tile: string) => void = () => undefined,
): SameSix {
  const { around, pointed, setPointed } = playing
  const onPoint: PointAt = (tile, pointing) => {
    if (ring.lineOf(tile) === undefined) return
    setPointed((current) => pointedAfter(current, tile, pointing))
  }
  const onLine = (line: number, does: (tile: string) => void) => {
    const tile = ring.tileOf(line)
    if (tile !== undefined) does(tile)
  }
  const names = (line: number) => ring.tileOf(line) !== undefined
  const pointedLine = pointed === undefined ? undefined : ring.lineOf(pointed)
  return {
    canvas: { pointed, onPoint },
    chat: {
      said: around.said,
      lines: {
        names,
        lit: (line) => names(line) && (line <= around.landed || line === pointedLine),
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
    },
  }
}
