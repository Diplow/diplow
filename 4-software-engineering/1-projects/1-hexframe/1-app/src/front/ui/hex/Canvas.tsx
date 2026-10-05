// The canvas: one <svg>, every hex a <polygon> with a real stroke, and the text in a <foreignObject>
// so it wraps like HTML, laid out by the shape (geometry/shape.ts); above it, the rings the center
// can show. The viewBox is the canvas's own coordinates, so the page sizes it with CSS and everything
// inside, text included, scales with it. The view is the caller's, from the URL: the canvas only says
// which view comes next.
import { cn } from 'cn'

import { m } from '#/paraglide/messages'

import { canvasSize, type EmptySlotTarget } from './geometry/shape'
import { EmptySlot, Frame, ListHex } from './Frame'
import { Button } from '../inputs/controls/button'
import { useCanvasState } from './state/useCanvasState'
import { Tile, type SwapTarget } from './Tile'
import type { FrameKind, InnerKind, OuterKind, TileNode } from './view/tiles'
import type { CanvasView, RingChoices } from './view/view'

interface CanvasProps {
  /** The System's root Tile, with everything below it. */
  system: TileNode
  view: CanvasView
  /** The next view, after a click: the caller puts it in the URL. */
  onViewChange: (view: CanvasView) => void
  /**
   * What a click on an empty slot does, and how a screen reader names it: add a Tile there, move one
   * there; `undefined` for a slot that takes no click. Without it, none does.
   */
  emptySlots?: (slot: EmptySlotTarget) => { label: string; onSelect: () => void } | undefined
  /**
   * Whether a Tile offers to trade places with the Tile on the move, how that is named and what it
   * does, on a small button of its own; `undefined` for a Tile that offers no swap. Without it, none
   * does.
   */
  swapTargets?: (tile: TileNode) => SwapTarget | undefined
  className?: string
}

export function Canvas({
  system,
  view,
  onViewChange,
  emptySlots,
  swapTargets,
  className,
}: CanvasProps) {
  const { state, actions } = useCanvasState({ system, view, onViewChange })
  const { width, height } = canvasSize
  return (
    <div className={cn('flex min-h-0 flex-col gap-2', className)}>
      <RingChooser
        title={state.center.title}
        rings={state.rings}
        onAround={actions.showAround}
        onInside={actions.showInside}
      />
      <svg
        viewBox={`0 0 ${String(width)} ${String(height)}`}
        role="group"
        aria-label={m.hex_canvas_label({ title: state.center.title })}
        className="min-h-0 w-full flex-1"
      >
        {state.hexes.map((hex) => {
          switch (hex.kind) {
            case 'ground':
              return <Frame key={hex.key} hex={hex} />
            case 'empty':
              return <EmptySlot key={hex.key} hex={hex} action={emptySlots?.(hex.slot)} />
            case 'list':
              return <ListHex key={hex.key} hex={hex} />
            case 'tile':
              return (
                <Tile
                  key={hex.key}
                  hex={hex}
                  action={actions.actionOf(hex)}
                  onAct={(repeat) => {
                    actions.click(hex, repeat)
                  }}
                  onCenter={(from) => {
                    actions.center(hex, from)
                  }}
                  swap={swapTargets?.(hex.tile)}
                />
              )
          }
        })}
      </svg>
    </div>
  )
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
