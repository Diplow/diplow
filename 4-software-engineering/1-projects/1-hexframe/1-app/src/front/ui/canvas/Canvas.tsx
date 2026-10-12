// The canvas: one <svg>, every hex drawn by its light (tile/), a Tile, a free slot, the ground of a
// hex opened in place, laid out by the shape (geometry/shape.ts), its words fitted to its size on
// screen; above it, the rings the center can show. The viewBox is the canvas's own coordinates, so
// the page sizes it with CSS and everything inside scales with it. The view is the caller's, from
// the URL: the canvas only says which view comes next, and blooms and folds what a hex opens.
import { Fragment, useRef } from 'react'
import { cn } from 'cn'

import { m } from '#/paraglide/messages'

import { canvasSize, type EmptySlotTarget } from './geometry/shape'
import type { Action } from './keys'
import { Button } from '../atoms/controls/button'
import { useCanvasState, type TileAction, type TileHex } from './state/useCanvasState'
import { useScale } from './state/useScale'
import { SwapDisc } from './tile/moving/Moving'
import { Ground, Slot } from './tile/places'
import { Tile, type TileWrite } from './tile/Tile'
import { listOf, lookOf, placeOf } from './view/looks'
import type { FrameKind, InnerKind, OuterKind, TileNode } from './view/tiles'
import type { CanvasView, RingChoices, ViewAction } from './view/view'

/** What is on its way to the System, as the canvas marks it. */
interface Writes {
  /** A Tile's write, by its id: on its way, or just refused; none for a Tile left alone. */
  tile: (id: string) => TileWrite | undefined
  /** Whether an import on its way lands in this free slot, where its tiles will be. */
  landing: (slot: EmptySlotTarget) => boolean
}

interface CanvasProps {
  /** The System's root Tile, with everything below it. */
  system: TileNode
  view: CanvasView
  /**
   * The next view, after a gesture: the caller puts it in the URL. `action` names the gesture and the
   * Tile it was made on, for a caller that records where the user went.
   */
  onViewChange: (view: CanvasView, action: ViewAction) => void
  /**
   * What a click on an empty slot does, and how a screen reader names it: add a Tile there, move one
   * there; `undefined` for a slot that takes no click. Without it, none does.
   */
  emptySlots?: (slot: EmptySlotTarget) => Action | undefined
  /**
   * A tile on the move: no Branch shows its frame at its foot, and `swapTargets` says whether a Tile
   * offers to trade places with it, how that is named and what it does, on a disc of its own at its
   * foot; `undefined` for a Tile that offers no swap. Without it, nothing moves.
   */
  move?: { swapTargets: (tile: TileNode) => Action | undefined }
  /** What is on its way: without it, nothing is. */
  writes?: Writes
  className?: string
}

export function Canvas({
  system,
  view,
  onViewChange,
  emptySlots,
  move,
  writes,
  className,
}: CanvasProps) {
  const { state, actions } = useCanvasState({ system, view, onViewChange })
  const svg = useRef<SVGSVGElement>(null)
  const scale = useScale(svg, canvasSize)
  const { width, height } = canvasSize

  /** A Tile's hex: the tile, by what it is and where it stands, and the swap it offers, if any. */
  const tileOf = (hex: TileHex) => {
    const action = actions.actionOf(hex)
    const swap = move?.swapTargets(hex.tile)
    return (
      <Fragment key={hex.key}>
        <Tile
          hex={hex.hex}
          {...lookOf(hex, { moving: move !== undefined })}
          place={placeOf(hex)}
          scale={scale}
          write={writes?.tile(hex.tile.id)}
          motion={actions.motionOf(hex.key)}
          action={
            action && {
              label: actionLabel(action, hex.tile.title),
              onSelect: () => {
                actions.click(hex)
              },
            }
          }
          onGoIn={(from) => {
            actions.center(hex, from)
          }}
        />
        {swap === undefined ? null : <SwapDisc hex={hex.hex} action={swap} scale={scale} />}
      </Fragment>
    )
  }

  return (
    <div className={cn('flex min-h-0 flex-col gap-2', className)}>
      <RingChooser
        title={state.center.title}
        rings={state.rings}
        onAround={actions.showAround}
        onInside={actions.showInside}
      />
      <svg
        ref={svg}
        viewBox={`0 0 ${String(width)} ${String(height)}`}
        role="group"
        aria-label={m.hex_canvas_label({ title: state.center.title })}
        className="min-h-0 w-full flex-1"
      >
        {state.hexes.map((hex) => {
          switch (hex.kind) {
            case 'ground':
              return <Ground key={hex.key} hex={hex.hex} context={hex.ring === 'context'} />
            case 'empty':
              return (
                <Slot
                  key={hex.key}
                  hex={hex.hex}
                  action={emptySlots?.(hex.slot)}
                  loading={writes?.landing(hex.slot) ?? false}
                />
              )
            case 'list':
              return <Tile key={hex.key} hex={hex.hex} {...listOf(hex)} scale={scale} />
            case 'tile':
              return tileOf(hex)
          }
        })}
      </svg>
    </div>
  )
}

/** What a click on a Tile does, as a screen reader hears it on its button. */
function actionLabel(action: TileAction, title: string): string {
  switch (action) {
    case 'expand':
      return m.hex_tile_expand({ title })
    case 'collapse':
      return m.hex_tile_collapse({ title })
    case 'show-context':
      return m.hex_tile_show_context({ title })
    case 'hide-context':
      return m.hex_tile_hide_context({ title })
    case 'hide-leaves':
      return m.hex_tile_hide_leaves({ title })
    case 'center':
      return m.hex_tile_center({ title })
  }
}

const kindNames: Record<FrameKind, () => string> = {
  children: m.hex_kind_children,
  branches: m.hex_kind_branches,
  leaves: m.hex_kind_leaves,
  context: m.hex_kind_context,
}

interface RingChooserProps {
  title: string
  rings: {
    around: OuterKind | undefined
    inside: InnerKind | undefined
    /** The kinds the center offers around it, and inside it beside the one around it. */
    choices: RingChoices
  }
  onAround: (kind: OuterKind) => void
  onInside: (kind: InnerKind | undefined) => void
}

/**
 * The rings the center shows, around it and inside its hex, each a row of buttons, the one shown
 * pressed. A row with nothing to choose is left out, so a centered Leaf shows none.
 */
function RingChooser({ title, rings, onAround, onInside }: RingChooserProps) {
  const { around, inside } = rings.choices
  if (around.length === 0) return null
  return (
    <div
      role="toolbar"
      aria-label={m.hex_rings_label({ title })}
      className="flex flex-wrap items-center gap-x-4 gap-y-1"
    >
      {around.length > 1 && (
        <Choice
          label={m.hex_ring_around()}
          options={around.map((kind) => ({ value: kind, name: kindNames[kind]() }))}
          chosen={rings.around}
          onChoose={onAround}
        />
      )}
      <Choice
        label={m.hex_ring_inside()}
        options={[
          { value: undefined, name: m.hex_kind_none() },
          ...inside.map((kind) => ({ value: kind, name: kindNames[kind]() })),
        ]}
        chosen={rings.inside}
        onChoose={onInside}
      />
    </div>
  )
}

interface ChoiceProps<T> {
  label: string
  options: { value: T; name: string }[]
  /** The option shown; none of them while the canvas shows nothing to choose from. */
  chosen: T | undefined
  onChoose: (value: T) => void
}

/** A row of buttons, one per option, the chosen one pressed. */
function Choice<T>({ label, options, chosen, onChoose }: ChoiceProps<T>) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-1">
      <span aria-hidden className="pr-1 text-xs text-muted-foreground">
        {label}
      </span>
      {options.map(({ value, name }) => (
        <Button
          key={name}
          variant={value === chosen ? 'secondary' : 'ghost'}
          size="xs"
          aria-pressed={value === chosen}
          onClick={() => {
            onChoose(value)
          }}
        >
          {name}
        </Button>
      ))}
    </div>
  )
}
