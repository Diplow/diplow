// What the tile's widgets share: a tile's words and their fields' names, its kinds and what each
// means, the six places by name, where a tile stands, said in a few words and drawn as its place, and
// a field read rather than written, an edit shown where it falls.
// `ui/` knows no domain, so these mirror Mapping's (`entities/tile.ts`): a Branch, a Leaf or a Context
// Tile, in one of six Directions; how long a Preview may be is its caller's to say.
import { cn } from 'cn'
import { Fragment, type ReactNode } from 'react'

import { m } from '#/paraglide/messages'

import { namesByPlace, Places, type Place } from '../Places'

/** What a reader finds in a tile, as the widget writes it. */
export interface TileWords {
  title: string
  preview: string
  body: string
}

export type TileField = keyof TileWords

/** Each field by its name, mid-sentence too. */
export const fieldNames: Record<TileField, () => string> = {
  title: m.system_field_title,
  preview: m.system_field_preview,
  body: m.widget_tile_page,
}

/** A Branch holds tiles of its own, a Leaf is a single file, a Context Tile says what its parent is. */
export type TileKind = 'branch' | 'leaf' | 'context'

/** Where a tile goes, or stands: the tile it is under, its kind, its place, and the places free. */
export interface TilePlace {
  parent: string
  kind: TileKind
  place: Place
  /** The places free for its kind, which a new tile may take. */
  free: readonly Place[]
}

/** Each place by its direction, as the canvas numbers them. */
const placeNames: Record<Place, () => string> = {
  1: m.direction_north_west,
  2: m.direction_north_east,
  3: m.direction_east,
  4: m.direction_south_east,
  5: m.direction_south_west,
  6: m.direction_west,
}

/** Where a tile stands, in a few words: "west in Projects", "context −6 of Projects". */
export function whereOf({ parent, kind, place }: TilePlace): string {
  if (kind === 'context') return m.widget_tile_where_context({ place: String(place), parent })
  const direction = placeNames[place]()
  return kind === 'leaf'
    ? m.widget_tile_where_leaf({ place: direction, parent })
    : m.widget_tile_where_branch({ place: direction, parent })
}

interface PlaceMarkProps {
  where: TilePlace
  label: string
  onPick?: (place: Place) => void
  /** Creating: the free places dashed, a pick takes one, and the place named under the map. */
  picking?: boolean
}

/**
 * The frame the tile goes in, its place lit: in the voice, or in Context's colour for a Context tile.
 * Creating, its name under the map, since the map alone tells a direction to the eye only.
 */
export function PlaceMark({ where, label, onPick, picking = false }: PlaceMarkProps) {
  const names = namesByPlace((place) =>
    where.free.includes(place) || place === where.place
      ? placeNames[place]()
      : m.widget_tile_place_taken({ place: placeNames[place]() }),
  )
  return (
    <span className={cn('block size-full', where.kind === 'context' && '[--voice:var(--context)]')}>
      <Places
        label={label}
        names={names}
        lit={where.place}
        free={picking ? where.free : []}
        onPick={onPick}
      />
      {picking && (
        <span
          aria-hidden
          className="absolute inset-x-0 top-full mt-1 hidden text-center font-mono text-[0.625rem] leading-tight text-muted-foreground sm:block"
        >
          {where.kind === 'context' ? `−${String(where.place)}` : placeNames[where.place]()}
        </span>
      )}
    </span>
  )
}

/** A stretch of a field an edit keeps, takes out or puts in. */
export interface Segment {
  readonly kind: 'same' | 'gone' | 'added'
  readonly text: string
}

/** A field read, not written: its label, then what it holds, the page in the user's serif. */
export function Read({
  label,
  prose = false,
  children,
}: {
  label: string
  prose?: boolean
  children: ReactNode
}) {
  return (
    <div className="grid gap-[3px]">
      <span className="text-[0.71875rem] text-muted-foreground">{label}</span>
      <p
        className={
          prose
            ? 'font-human text-[0.96875rem] leading-[1.55] font-light whitespace-pre-wrap text-muted-foreground'
            : 'text-sm leading-[1.55] font-light text-muted-foreground'
        }
      >
        {children}
      </p>
    </div>
  )
}

/**
 * A field's change where it falls: what goes struck in faint, what comes on the agent's violet ground,
 * each said to a screen reader, which shows neither.
 */
export function Diff({
  label,
  segments,
  prose = false,
}: {
  label: string
  segments: readonly Segment[]
  /** A page's, in the user's serif, its lines kept. */
  prose?: boolean
}) {
  return (
    <Read label={label} prose={prose}>
      {segments.map((segment, index) =>
        segment.kind === 'same' ? (
          <Fragment key={index}>{segment.text}</Fragment>
        ) : segment.kind === 'gone' ? (
          <del
            key={index}
            className="text-faint decoration-destructive/60 decoration-from-font [text-decoration-line:line-through]"
          >
            <span className="sr-only">{m.widget_tile_gone()} </span>
            {segment.text}
          </del>
        ) : (
          <ins key={index} className="bg-agent/18 px-[0.15em] text-foreground no-underline">
            <span className="sr-only">{m.widget_tile_added()} </span>
            {segment.text}
          </ins>
        ),
      )}
    </Read>
  )
}
