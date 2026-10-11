// What the tile's widgets share: a tile's words, its kinds and what each means, the six places by
// name, where a tile stands, said in a few words and drawn as its place, and the receipt a write
// leaves. `ui/` knows no domain, so these mirror Mapping's (`entities/tile.ts`): a Branch, a Leaf or a
// Context Tile, a Preview of 350 characters.
import { cn } from 'cn'

import { m } from '#/paraglide/messages'

import { Places, places, type Place } from '../Places'

/** What a reader finds in a tile, as the widget writes it. */
export interface TileWords {
  title: string
  preview: string
  body: string
}

export type TileField = keyof TileWords

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

/** The most characters a Preview holds, as a reader counts them: Mapping's `previewLimit`. */
export const previewLimit = 350

export const kinds = [
  { id: 'branch', label: m.widget_tile_kind_branch, means: m.widget_tile_kind_branch_means },
  { id: 'leaf', label: m.widget_tile_kind_leaf, means: m.widget_tile_kind_leaf_means },
  { id: 'context', label: m.widget_tile_kind_context, means: m.widget_tile_kind_context_means },
] as const satisfies ReadonlyArray<{ id: TileKind; label: () => string; means: () => string }>

/** Each place by its direction, as the canvas numbers them. */
export const placeNames: Record<Place, () => string> = {
  1: m.widget_place_north_west,
  2: m.widget_place_north_east,
  3: m.widget_place_east,
  4: m.widget_place_south_east,
  5: m.widget_place_south_west,
  6: m.widget_place_west,
}

/** Where a tile stands, in a few words: "west in Projects", "context −6 of Projects". */
export function whereOf({ parent, kind, place }: TilePlace): string {
  if (kind === 'context') return m.widget_tile_where_context({ place: String(place), parent })
  const direction = placeNames[place]()
  return kind === 'leaf'
    ? m.widget_tile_where_leaf({ place: direction, parent })
    : m.widget_tile_where_branch({ place: direction, parent })
}

/** Once a write is sent, the widget leaves one line: what was done, to which tile, where. */
export interface Done {
  mode: 'done'
  did: 'created' | 'edited' | 'deleted'
  title: string
  where: TilePlace
  /** When, as the conversation shows its times. */
  at?: string
  onUndo?: () => void
}

const did: Record<Done['did'], () => string> = {
  created: m.widget_tile_did_create,
  edited: m.widget_tile_did_edit,
  deleted: m.widget_tile_did_delete,
}

/** The receipt's line: "Created **Tooling**, west in Projects". */
export function receiptOf({ did: what, title, where, at, onUndo }: Done) {
  return {
    text: (
      <>
        {did[what]()} <b>{title}</b>, {whereOf(where)}
      </>
    ),
    at,
    onUndo,
  }
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
  const names = Object.fromEntries(
    places.map((place) => [
      place,
      where.free.includes(place) || place === where.place
        ? placeNames[place]()
        : m.widget_tile_place_taken({ place: placeNames[place]() }),
    ]),
  ) as Record<Place, string>
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
