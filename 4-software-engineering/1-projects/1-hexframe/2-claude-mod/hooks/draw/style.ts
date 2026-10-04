// What every drawing of a Frame shares, the terminal's and the SVG: the colors a hex takes, and
// its words wrapped to the room it has.
import type { TileHex } from '../shape/layout.js'
import type { MemberKind } from '../shape/node.js'

/** A hex's colors, as `0xrrggbb`: the SVG writes the same ones as `#rrggbb`. */
export interface Palette {
  background: number
  title: number
  preview: number
}

export const palettes: Record<'center' | MemberKind, Palette> = {
  center: { background: 0x5b3cc4, title: 0xffffff, preview: 0xddd6fe },
  branch: { background: 0x2f3446, title: 0xf3f4f6, preview: 0x9ca3af },
  leaf: { background: 0x4a3426, title: 0xfde7d0, preview: 0xd4a373 },
  context: { background: 0x134e4a, title: 0xccfbf1, preview: 0x5eead4 },
}

export const emptyOutline = 0x4b5563
/** The outline of the hex whose button holds the focus. */
export const selectedOutline = 0xfbbf24

/** The palette of a hex that holds a Tile: the center's, or its member's kind's. */
export function paletteOf(placement: TileHex): Palette {
  return palettes[placement.kind === 'center' ? 'center' : placement.memberKind]
}

/** Words in lines of at most `width`, at most `limit` lines, the last cut with an ellipsis. */
export function wrap(text: string, width: number, limit: number): string[] {
  if (limit <= 0 || width <= 0) return []
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line === '' ? word : `${line} ${word}`
    if ([...candidate].length <= width) {
      line = candidate
      continue
    }
    if (line !== '') lines.push(line)
    // A word wider than a line is cut, not broken across two.
    line = [...word].length <= width ? word : `${[...word].slice(0, width - 1).join('')}…`
  }
  if (line !== '') lines.push(line)
  if (lines.length <= limit) return lines
  const kept = lines.slice(0, limit)
  kept[limit - 1] = ellipsize(kept[limit - 1] ?? '', width)
  return kept
}

function ellipsize(line: string, width: number): string {
  const glyphs = [...line]
  return glyphs.length < width ? `${line}…` : `${glyphs.slice(0, width - 1).join('')}…`
}
