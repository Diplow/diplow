// What the canvas draws while a tile moves (HEX-105's proposal, from components.html's #moving): the
// tile lifted, its rim a dashed line in your amber that runs; each free slot offering itself, saying
// "Here" under the pointer; each Branch offering to trade places by a disc at its foot, apart from its
// own click; the rest stepped back; and a banner saying what moves, with its way out. A drag starts it
// under a mouse or a pen and never under a finger, whose way is the menu or the M key (`partOf`
// says what each place offers, `drag.ts` follows the drag). Carried off the canvas, the tile follows
// the pointer over the page, for the composer to name where it is let go (HEX-108).
import { cn } from 'cn'
import { ArrowLeftRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { m } from '#/paraglide/messages'

import { Act } from '../../../atoms/controls/act'
import type { Hex } from '../../geometry/geometry'
import { buttonKeys, type Action } from '../../keys'
import { points } from '../light'
import type { TileLook } from '../Tile'

/** The banner across the moving frame: what moves and how to stop, Escape or a tap on Stop. */
export function MoveBanner({ title, onStop }: { title: string; onStop: () => void }) {
  return (
    <div
      role="status"
      className="relative flex items-center gap-2.5 bg-linear-to-r from-human/12 to-transparent to-85% py-1.5 pr-2 pl-4 text-[0.8125rem] font-light text-muted-foreground before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-linear-to-r before:from-human before:to-transparent before:to-80% motion-safe:animate-rise"
    >
      <span className="min-w-0 flex-1">
        {m.tile_moving_banner_before()}
        <b className="font-normal text-foreground">{title}</b>
        {m.tile_moving_banner_after()}
      </span>
      <Act shortcut={{ key: 'Escape' }} onClick={onStop}>
        {m.tile_moving_stop()}
      </Act>
    </div>
  )
}

/**
 * The tile on the move, lifted a little above the rest, its rim running in your amber; dragged, it
 * follows the pointer. `lifted` false draws it at rest, in the same group, so a tile that starts or
 * stops moving keeps its element, and the focus it holds.
 */
export function Lifted({
  hex,
  lifted = true,
  children,
}: {
  hex: Hex
  lifted?: boolean
  children: ReactNode
}) {
  return (
    <g
      className={cn(
        'transition-[scale] duration-200 ease-glide motion-reduce:transition-none',
        lifted && 'scale-105',
      )}
      style={{ transformOrigin: `${String(hex.center.x)}px ${String(hex.center.y)}px` }}
    >
      {children}
      {lifted && (
        <polygon
          points={points(hex)}
          fill="none"
          strokeWidth={1.5}
          strokeDasharray="6 5"
          vectorEffect="non-scaling-stroke"
          className="pointer-events-none stroke-human motion-safe:animate-ants"
        />
      )}
    </g>
  )
}

/** A tile as drawn while one moves: no Branch shows its frame at its foot, where its swap sits. */
export function withoutFoot(look: TileLook): TileLook {
  if (look.kind !== 'branch' && look.kind !== 'root') return look
  return { kind: look.kind, words: look.words }
}

/**
 * A place that takes no part while a tile moves, or while another's menu is open: a third of its
 * light, and no hover. `aside` false draws it whole, in the same group, so its light comes back
 * over the same 450ms it stepped back in. `reachable` keeps its click, where the canvas is still
 * taken while a tile moves, to open or center the way to a slot further off.
 */
export function Aside({
  aside = true,
  reachable = false,
  children,
}: {
  aside?: boolean
  reachable?: boolean
  children: ReactNode
}) {
  return (
    <g
      className={cn(
        'transition-opacity duration-450',
        aside && 'opacity-33',
        aside && !reachable && 'pointer-events-none',
      )}
    >
      {children}
    </g>
  )
}

const offered =
  'stroke-human/45 group-hover:fill-human/10 group-hover:stroke-human group-focus-visible:fill-human/10 group-focus-visible:stroke-human'
const lit = 'fill-human/10 stroke-human'

// The swap's disc, warmed a fifth toward your amber over the ground it hides; written out whole for
// each state, since Tailwind finds its classes in the code as written.
const warmed = 'fill-[color-mix(in_oklab,var(--human)_20%,var(--background))] stroke-human'
const warms =
  'stroke-human/60 group-hover:fill-[color-mix(in_oklab,var(--human)_20%,var(--background))] group-hover:stroke-human group-focus-visible:fill-[color-mix(in_oklab,var(--human)_20%,var(--background))] group-focus-visible:stroke-human'

/**
 * A free slot offering itself to the tile on the move: dashed in your amber, warming under the
 * pointer or the drag, where it says "Here". A button, which lands the tile there.
 */
export function LandingSlot({
  hex,
  action,
  over = false,
}: {
  hex: Hex
  action: Action
  over?: boolean
}) {
  const { center, radius } = hex
  const { label, onSelect } = action
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={label}
      className="group cursor-pointer outline-none"
      onClick={onSelect}
      {...buttonKeys({ onEnter: onSelect, onSpace: onSelect })}
    >
      <polygon
        points={points(hex)}
        strokeDasharray="4 4"
        vectorEffect="non-scaling-stroke"
        className={cn('fill-transparent transition-colors duration-200', over ? lit : offered)}
      />
      <text
        x={center.x}
        y={center.y}
        textAnchor="middle"
        dominantBaseline="central"
        aria-hidden
        className={cn(
          'pointer-events-none fill-human font-human italic opacity-0 transition-opacity',
          over ? 'opacity-100' : 'group-hover:opacity-100 group-focus-visible:opacity-100',
        )}
        style={{ fontSize: radius * 0.18 }}
      >
        {m.tile_moving_here()}
      </text>
    </g>
  )
}

/**
 * A Branch's offer to trade places with the tile on the move: a small hex with two arrows at its
 * foot, a button apart from the tile's own click, which still opens it. Under a finger its target
 * grows to 44px; `scale` is the screen px per unit of the hex.
 */
export function SwapDisc({
  hex,
  action,
  over = false,
  scale = 1,
}: {
  hex: Hex
  action: Action
  over?: boolean
  scale?: number
}) {
  const size = Math.max(hex.radius * 0.13, 11 / scale)
  const center = { x: hex.center.x, y: hex.center.y + hex.radius - size * 0.6 }
  const { label, onSelect } = action
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={label}
      className="group cursor-pointer text-human outline-none motion-safe:animate-rise"
      onClick={onSelect}
      {...buttonKeys({ onEnter: onSelect, onSpace: onSelect })}
    >
      <circle
        cx={center.x}
        cy={center.y}
        r={22 / scale}
        className="hidden fill-transparent pointer-coarse:block"
      />
      <polygon
        points={points({ center, radius: size })}
        vectorEffect="non-scaling-stroke"
        className={cn('fill-background transition-colors duration-200', over ? warmed : warms)}
      />
      <ArrowLeftRight
        x={center.x - size * 0.56}
        y={center.y - size * 0.56}
        width={size * 1.12}
        height={size * 1.12}
        strokeWidth={1.7}
        aria-hidden
      />
    </g>
  )
}

/**
 * A tile carried off the canvas, under a mouse or a pen, following the pointer over the page: its hex
 * and its title on a risen surface, its line in your amber, for the composer to name where it is let
 * go (HEX-108). Drawn over the page, outside the canvas's <svg>, and for the eye alone: what takes it
 * says so itself.
 */
export function Carried({ title, at }: { title: string; at: { x: number; y: number } }) {
  return createPortal(
    <div
      aria-hidden
      className="risen pointer-events-none fixed z-50 flex items-center gap-2 px-3 py-1.5 font-human text-sm text-foreground [--rim:var(--human)]"
      style={{ left: at.x + 14, top: at.y + 12 }}
    >
      <svg viewBox="-10 -10 20 20" className="size-3 overflow-visible">
        <polygon
          points={points({ center: { x: 0, y: 0 }, radius: 9 })}
          vectorEffect="non-scaling-stroke"
          className="fill-human/20 stroke-human"
        />
      </svg>
      {title}
    </div>,
    document.body,
  )
}
