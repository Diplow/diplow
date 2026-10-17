// The small hex the chat marks with: before a named tile, on the events' thread, beside an action, in
// front of the agent's words. Its colour is the text's, so a class colours it like any word.
import { cn } from 'cn'

// A regular hex of radius 9 in a square of 20, pointy on top, or flat on top as the agent's mark is.
const pointy = '7.79,4.5 0,9 -7.79,4.5 -7.79,-4.5 0,-9 7.79,-4.5'
const flat = '9,0 4.5,7.79 -4.5,7.79 -9,0 -4.5,-7.79 4.5,-7.79'

interface HexMarkProps {
  /** Flat on top, as the agent's mark; pointy on top otherwise. */
  flat?: boolean
  /** A line, not a fill: a key from outside, a tile deleted, the agent's mark. */
  hollow?: boolean
  /** Its size and colour, `size-2 text-agent`; a `fill-*` or `stroke-*` overrides the colour's. */
  className?: string
}

export function HexMark({ flat: isFlat = false, hollow = false, className }: HexMarkProps) {
  return (
    <svg
      aria-hidden
      viewBox="-10 -10 20 20"
      className={cn(
        'inline-block shrink-0 overflow-visible',
        hollow ? 'fill-none stroke-current' : 'fill-current',
        className,
      )}
    >
      <polygon points={isFlat ? flat : pointy} strokeWidth={1} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
