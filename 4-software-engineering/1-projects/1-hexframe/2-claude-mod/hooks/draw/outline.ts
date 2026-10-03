// Draws a Frame as lines of text: where no drawing fits, and for readers that can't see one.
import { oneLine } from '../markdown.js'
import { basename, directions, membersOf, type Direction } from '../shape/node.js'
import type { FrameView } from '../shape/layout.js'

/** The Tile's title and preview, then a line per direction; the member in `selected` marked. */
export function outline({ frame, frameKind }: FrameView, selected?: Direction): string {
  const members = membersOf(frame.rings[frameKind])
  const lines = [frame.tile.title, ...(frame.tile.preview ? [frame.tile.preview] : []), '']
  for (const direction of directions) {
    const mark = direction === selected ? '›' : ' '
    const member = members[direction]
    const file = member?.kind === 'leaf' ? `  (${basename(member.tile.path)})` : ''
    lines.push(`${mark}${direction}  ${member?.tile.title ?? '·'}${file}`)
  }
  return lines.map(oneLine).join('\n')
}
