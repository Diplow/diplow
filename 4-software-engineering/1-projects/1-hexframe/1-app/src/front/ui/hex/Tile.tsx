// A Tile on the canvas: its hex, its title always, its preview when there is room, and on hover or
// focus a card with both in full. It is a button: what a click does comes from the Canvas.
import type { KeyboardEvent, MouseEvent } from 'react'

import { m } from '#/paraglide/messages'

import { Tooltip } from '../overlays/Tooltip'
import { textBox } from './geometry/geometry'
import type { Placement } from './geometry/layout'
import { HexShape, polygonPoints, showsPreview, strokeWidth, TileLabel } from './look'
import type { TileAction } from './view/view'

interface TileProps {
  placement: Extract<Placement, { kind: 'tile' }>
  action: TileAction
  /** A click, Enter or Space. `repeat` is the second click of a double-click. */
  onAct: (repeat: boolean) => void
  /** A double-click, or Shift+Enter. */
  onCenter: (from: 'pointer' | 'keyboard') => void
}

export function Tile({ placement, action, onAct, onCenter }: TileProps) {
  const { title, preview } = placement.tile
  const label = textBox(placement.hex, showsPreview(placement) ? 'tall' : 'wide')
  // As a button does: Enter acts as it goes down, Space as it comes up; Space going down only keeps
  // the page from scrolling.
  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    // A held key repeats: act once per press, not once per repeat.
    if (event.key !== 'Enter' || event.repeat) return
    if (event.shiftKey) onCenter('keyboard')
    else onAct(false)
  }
  function onKeyUp(event: KeyboardEvent) {
    if (event.key !== ' ') return
    event.preventDefault()
    onAct(false)
  }
  return (
    <Tooltip
      content={
        <span className="grid max-w-64 gap-1">
          <span className="font-semibold">{title}</span>
          {preview === '' ? null : <span className="opacity-80">{preview}</span>}
        </span>
      }
    >
      <g
        role="button"
        tabIndex={0}
        aria-label={actionLabel(action, title)}
        aria-expanded={expanded[action]}
        className="group cursor-pointer outline-none"
        onClick={(event: MouseEvent) => {
          onAct(event.detail > 1)
        }}
        onDoubleClick={() => {
          onCenter('pointer')
        }}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
      >
        <HexShape placement={placement} />
        {/* The hover and focus ring, drawn over the outline. */}
        <polygon
          points={polygonPoints(placement.hex)}
          className="fill-none stroke-transparent group-hover:stroke-brand group-focus-visible:stroke-ring"
          strokeWidth={strokeWidth * 2}
          strokeLinejoin="round"
        />
        <foreignObject x={label.x} y={label.y} width={label.width} height={label.height}>
          <TileLabel placement={placement} />
        </foreignObject>
      </g>
    </Tooltip>
  )
}

/** Whether what the Tile's action opens or closes is open: its Frame, or the center's Context. */
const expanded: Record<TileAction, boolean | undefined> = {
  expand: false,
  collapse: true,
  'show-context': false,
  'hide-context': true,
  center: undefined,
}

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
    case 'center':
      return m.hex_tile_center({ title })
  }
}
