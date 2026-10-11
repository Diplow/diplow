// A frame in small, in a widget's hex's place: the tile in the middle and its six places around it,
// numbered as the canvas numbers them, 1 north-west, clockwise, to 6 west. One is lit in the widget's
// voice, the free ones dashed. Where the user may pick a place, the six are a radio group: a click,
// or the arrows, take one, so the map is also the way around.
import { cn } from 'cn'
import { type KeyboardEvent, useRef } from 'react'

/** A place around the tile in the middle: 1 north-west, clockwise, to 6 west. */
export type Place = 1 | 2 | 3 | 4 | 5 | 6

export const places: readonly Place[] = [1, 2, 3, 4, 5, 6]

/** Each place's name, from what stands there or where it lies. */
export const namesOf = (name: (place: Place) => string): Record<Place, string> => ({
  1: name(1),
  2: name(2),
  3: name(3),
  4: name(4),
  5: name(5),
  6: name(6),
})

/** A hex's radius in the map, and the gap between two. */
const radius = 7.2
const gap = 0.8

/** Each place's angle from the middle, pointy-top as the canvas draws. */
const angles: Record<Place, number> = { 1: -120, 2: -60, 3: 0, 4: 60, 5: 120, 6: 180 }

const corners = (x: number, y: number) =>
  Array.from({ length: 6 }, (_, corner) => {
    const angle = ((-90 + 60 * corner) * Math.PI) / 180
    return `${(x + radius * Math.cos(angle)).toFixed(2)},${(y + radius * Math.sin(angle)).toFixed(2)}`
  }).join(' ')

const centerOf = (place: Place) => {
  const angle = (angles[place] * Math.PI) / 180
  const far = Math.sqrt(3) * (radius + gap)
  return [far * Math.cos(angle), far * Math.sin(angle)] as const
}

interface PlacesProps {
  /** What the map says, for a screen reader: "Where it goes", "Help's topics". */
  label: string
  /** Each place's name, said for it and shown as its tooltip: its direction, or the tile there. */
  names: Readonly<Record<Place, string>>
  /** The place the widget is about, lit in its voice. */
  lit?: Place | undefined
  /** The places free to take, dashed; the others hold a tile. */
  free?: readonly Place[]
  /** Takes a place; the map is a radio group then, with `pickable` its choices. */
  onPick?: (place: Place) => void
  /** The places a pick may take: the free ones and the lit one unless said. */
  pickable?: readonly Place[]
  className?: string
}

/** The tile in the middle, its six places around it, one lit. */
export function Places({
  label,
  names,
  lit,
  free = [],
  onPick,
  pickable = [...free, ...(lit === undefined ? [] : [lit])],
  className,
}: PlacesProps) {
  const map = useRef<SVGSVGElement>(null)
  const choices = places.filter((place) => onPick !== undefined && pickable.includes(place))
  // The arrows go round the choices, clockwise forward, and take the one they land on.
  const step = (event: KeyboardEvent, from: Place) => {
    const by = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
    if (by === undefined || onPick === undefined) return
    event.preventDefault()
    const at = choices.indexOf(from)
    const next = choices[(at + by + choices.length) % choices.length]
    if (next === undefined) return
    onPick(next)
    map.current?.querySelector<SVGElement>(`[data-place="${String(next)}"]`)?.focus()
  }
  const tabStop = lit !== undefined && choices.includes(lit) ? lit : choices[0]
  return (
    <svg
      ref={map}
      viewBox="-27 -25 54 50"
      role={choices.length > 0 ? 'radiogroup' : 'img'}
      aria-label={lit === undefined || choices.length > 0 ? label : `${label}: ${names[lit]}`}
      className={cn('size-full overflow-visible', className)}
    >
      <polygon
        points={corners(0, 0)}
        vectorEffect="non-scaling-stroke"
        className="fill-foreground/9 stroke-input"
      />
      {places.map((place) => {
        const [x, y] = centerOf(place)
        const choosable = choices.includes(place)
        return (
          <polygon
            key={place}
            data-place={place}
            points={corners(x, y)}
            vectorEffect="non-scaling-stroke"
            {...(choosable
              ? {
                  role: 'radio',
                  'aria-checked': place === lit,
                  'aria-label': names[place],
                  tabIndex: place === tabStop ? 0 : -1,
                  onClick: () => onPick?.(place),
                  onKeyDown: (event: KeyboardEvent) => {
                    if (event.key === ' ' || event.key === 'Enter') {
                      event.preventDefault()
                      onPick?.(place)
                    } else step(event, place)
                  },
                }
              : { 'aria-hidden': true })}
            className={cn(
              'fill-transparent stroke-input transition-[fill,stroke] duration-300',
              free.includes(place) && place !== lit && '[stroke-dasharray:1_3] opacity-70',
              place === lit && 'fill-(--voice)/24 stroke-(--voice) opacity-100',
              choosable &&
                'cursor-pointer outline-none hover:stroke-(--voice) hover:[stroke-dasharray:none] hover:opacity-100 focus-visible:fill-(--voice)/12 focus-visible:stroke-(--voice) focus-visible:[stroke-dasharray:none] focus-visible:opacity-100',
            )}
          >
            <title>{names[place]}</title>
          </polygon>
        )
      })}
    </svg>
  )
}
