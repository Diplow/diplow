// A tile, drawn by its light alone (HEX-104's proposal; HEX-106 puts it on the canvas in place of
// ../Tile.tsx). What it is, where it stands, what happens to it and who touches it change that
// light, and never add a box: a Branch fades toward its foot, where its frame shows in small; a Leaf
// is lit evenly; the Context is teal; the root, the only warm tile, is you. Under the pointer the
// light rises; the keyboard's focus is the ring's amber line; the center keeps the one steady line.
// A write still on its way sweeps a light over it; refused, it flares and its caller puts it back.
// Its words are fitted to its size on screen (words.ts). It is an SVG group, drawn inside the
// canvas's <svg> at its hex, and a button when its caller says what a click does.
import { Link } from 'lucide-react'
import { Slot } from 'radix-ui'
import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { cn } from 'cn'

import { m } from '#/paraglide/messages'

import {
  directions,
  neighbor,
  scaled,
  type Direction,
  type Hex,
  type Point,
} from '../geometry/geometry'
import { buttonKeys, type Action, type Hand } from '../keys'
import { BlurDef, FadeDef, points, Sweep, tint, type Fade } from './light'
import { fitWords, linesThatFit } from '../geometry/words'

/**
 * Where it stands: in a ring, at the center, at the heart of a Branch opened in place, beside the
 * frame, or further out.
 */
type TilePlace = 'ring' | 'center' | 'heart' | 'near' | 'far'

/** A state the hand gives, held without it: on /design-system, or by whatever points at the tile. */
type Held = 'pointed' | 'focused' | 'pressed'

/** A write on the tile, still on its way or refused. */
type TileWrite = 'pending' | 'refused'

/**
 * Blooming out of its parent's heart, or folding back into it, `order` siblings after its eldest,
 * each `--stagger-bloom` apart.
 */
export interface TileMotion {
  way: 'bloom' | 'fold'
  from: Point
  order?: number
}

/** A tile's words: its title, and its preview. */
export interface TileWords {
  title: string
  preview?: string
}

/** What a tile is, which its light says before its words do, with what that kind alone takes. */
export type TileLook = { words: TileWords } & (
  | {
      kind: 'root' | 'branch'
      /** The Directions its children hold, drawn small at its foot. */
      foot?: readonly Direction[]
    }
  | {
      kind: 'leaf'
      /** A Leaf that isn't Markdown: its title is its file's name, in mono. */
      file?: boolean
      /** The title of the Branch it is numbered as, which the shape seated it beside. */
      clash?: string
    }
  | {
      kind: 'reference'
      /** Where the tile it points at lives. */
      from: string
    }
  | {
      kind: 'list'
      /** A ring too full: the names it holds. */
      names: readonly string[]
    }
  | { kind: 'untitled' | 'context' | 'broken' | 'draft' }
)

type TileKind = TileLook['kind']

export type TileProps = TileLook & {
  hex: Hex
  place?: TilePlace
  write?: TileWrite
  held?: Held
  motion?: TileMotion
  /** What a click does, and its name for a screen reader; without it, the tile is no button. */
  action?: Action
  /** Screen px per unit of the hex, so the words fit the tile's size on screen. 1 by default. */
  scale?: number
  /** What its menu and its hover card hand it; a tile handed them takes the focus, a button or not. */
  hand?: Hand
}

/** What only one kind takes, read off any tile: none for the others. */
const clashOf = (look: TileLook) => (look.kind === 'leaf' ? look.clash : undefined)
const footOf = (look: TileLook) =>
  look.kind === 'root' || look.kind === 'branch' ? look.foot : undefined

/** The word under its title and preview, in its tone: where a Reference lives, a clash, a draft. */
interface Note {
  text: string
  tone: string
}

function noteOf(look: TileLook): Note | undefined {
  switch (look.kind) {
    case 'leaf':
      return look.clash === undefined
        ? undefined
        : { text: m.tile_clash({ branch: look.clash }), tone: 'text-warning' }
    case 'reference':
      return { text: m.tile_reference_from({ place: look.from }), tone: 'text-context' }
    case 'broken':
      return { text: m.tile_broken_note(), tone: 'text-faint' }
    case 'draft':
      return { text: m.tile_drafting(), tone: 'text-agent' }
    default:
      return undefined
  }
}

/** Its words in the canvas's own units, fitted to its size on screen; none on the smallest tile. */
interface Sized {
  title: number
  preview: number | undefined
  width: number
  height: number
}

function sizedOf(hex: Hex, scale: number): Sized | undefined {
  const fit = fitWords(hex.radius * scale)
  if (fit === undefined) return undefined
  return {
    title: fit.title / scale,
    preview: fit.preview === undefined ? undefined : fit.preview / scale,
    width: fit.width / scale,
    height: fit.height / scale,
  }
}

interface Lights {
  rest: Fade
  lit: Fade
}

const evenly = (color: string): Fade => ({ top: color, foot: color })
const between = (one: string, other: string, percent: number) =>
  `color-mix(in oklab, var(--${one}) ${String(percent)}%, var(--${other}))`
const warm = (top: number, foot: number): Fade => ({
  top: tint('glow', top),
  foot: tint('glow-soft', foot),
  diagonal: true,
})
const tile: Lights = {
  rest: { top: 'var(--tile)', foot: 'var(--tile-fade)' },
  lit: { top: 'var(--tile-lit)', foot: 'var(--tile-lit-fade)' },
}
const teal: Lights = {
  rest: { top: tint('context', 16), foot: tint('context', 4) },
  lit: { top: tint('context', 26), foot: tint('context', 8) },
}

const lights: Record<TileKind, Lights> = {
  root: { rest: warm(34, 6), lit: warm(46, 12) },
  untitled: { rest: warm(15, 3), lit: warm(22, 6) },
  branch: tile,
  list: tile,
  leaf: {
    rest: evenly(between('tile', 'tile-fade', 55)),
    lit: evenly(between('tile-lit', 'tile-lit-fade', 60)),
  },
  context: teal,
  reference: teal,
  broken: { rest: evenly('transparent'), lit: evenly(tint('foreground', 4)) },
  draft: {
    rest: { top: tint('agent', 14), foot: tint('agent', 0) },
    lit: { top: tint('agent', 22), foot: tint('agent', 4) },
  },
}

/** A line of its own: the Context's hairline, dashed where it is not done or not there. */
interface Rim {
  color: string
  dash?: string
}

const ember: Rim = { color: tint('warning', 60) }

const rims: Partial<Record<TileKind, Rim>> = {
  context: { color: tint('context', 45) },
  reference: { color: tint('context', 45), dash: '3 3' },
  broken: { color: tint('faint', 70), dash: '2 4' },
  untitled: { color: tint('glow', 55), dash: '3 4' },
  list: ember,
}

const opacities: Record<TilePlace, string> = {
  ring: '',
  center: '',
  heart: '',
  near: 'opacity-50',
  far: 'opacity-13',
}

export function Tile(props: TileProps) {
  const { hex, kind, words, place = 'ring', write, held, motion, action, scale = 1, hand } = props
  const id = useId()
  const pending = write === 'pending'
  const sized = sizedOf(hex, scale)
  // At the center and at a heart, the ring around it says what the foot would; elsewhere the foot
  // comes with the preview, once there is room for more than the title.
  const foot =
    place === 'center' || place === 'heart' || sized?.preview === undefined
      ? undefined
      : footOf(props)
  const description = [
    kindNames[kind](),
    noteOf(props)?.text,
    pending ? m.tile_write_pending() : undefined,
    write === 'refused' ? m.tile_write_refused() : undefined,
  ]
    .filter(Boolean)
    .join(', ')
  return (
    <g
      className={cn(
        'transition-opacity duration-450',
        opacities[place],
        motion?.way === 'bloom' && 'motion-safe:animate-bloom',
        motion?.way === 'fold' && 'motion-safe:animate-fold motion-reduce:opacity-0',
      )}
      style={motion && origin(motion.from, motion.order)}
    >
      <Slot.Root {...hand}>
        <g
          {...(action === undefined
            ? {
                role: 'img',
                'aria-label': words.title,
                ...(hand && { tabIndex: 0, className: 'group outline-none' }),
              }
            : {
                role: 'button',
                tabIndex: 0,
                'aria-label': action.label,
                className: 'group cursor-pointer outline-none',
                onClick: action.onSelect,
                ...buttonKeys({ onEnter: action.onSelect, onSpace: action.onSelect }),
              })}
          aria-description={description}
          aria-busy={pending || undefined}
        >
          <g
            className={cn(
              'transition-[scale] duration-200 ease-glide motion-reduce:transition-none',
              action !== undefined && 'group-active:scale-[.965]',
              held === 'pressed' && 'scale-[.965]',
            )}
            style={origin(hex.center)}
          >
            <Light {...props} id={id} />
            {foot === undefined ? null : <Foot hex={hex} kids={foot} scale={scale} />}
            {pending ? <Sweep hex={hex} /> : null}
            {sized === undefined ? null : <Words {...props} sized={sized} />}
          </g>
        </g>
      </Slot.Root>
    </g>
  )
}

/** Where a transform starts, in the canvas's own coordinates, and how many siblings it waits for. */
function origin({ x, y }: Point, order?: number): CSSProperties {
  return {
    transformOrigin: `${String(x)}px ${String(y)}px`,
    transformBox: 'view-box',
    ...(order !== undefined && { animationDelay: `calc(var(--stagger-bloom) * ${String(order)})` }),
  }
}

/** Its line of its own, if any: a clash's ember, its kind's hairline, or the center's steady line. */
function rimOf(props: TileProps, id: string): Rim | undefined {
  const { kind, place = 'ring' } = props
  if (clashOf(props) !== undefined) return ember
  const own = rims[kind]
  if (own !== undefined || place !== 'center') return own
  return { color: kind === 'root' || kind === 'untitled' ? `url(#${id}-rim)` : 'var(--input)' }
}

/** Its fill, lit or not, its lines, and the lights around it. */
function Light(props: TileProps & { id: string }) {
  const { hex, kind, place = 'ring', held, action, hand, id } = props
  const lit = place === 'center' || place === 'heart' || held === 'pointed' || held === 'pressed'
  const rim = rimOf(props, id)
  return (
    <>
      <defs>
        <FadeDef id={`${id}-rest`} fade={lights[kind].rest} />
        <FadeDef id={`${id}-lit`} fade={lights[kind].lit} />
        <FadeDef
          id={`${id}-rim`}
          fade={{ top: 'var(--glow-soft)', foot: tint('human', 20), diagonal: true }}
        />
      </defs>
      <Glows {...props} />
      <polygon points={points(hex)} fill={`url(#${id}-rest)`} />
      <polygon
        points={points(hex)}
        fill={`url(#${id}-lit)`}
        className={cn(
          'transition-opacity duration-300',
          lit ? 'opacity-100' : 'opacity-0',
          action !== undefined && 'group-hover:opacity-100 group-focus-visible:opacity-100',
          // Its menu open, or its card, it stays lit: Radix marks what opened them.
          hand !== undefined && 'group-data-[state=open]:opacity-100',
        )}
      />
      {props.write === 'refused' ? (
        <polygon
          points={points(scaled(hex, 0.85))}
          filter={`url(#${id}-blur)`}
          className="pointer-events-none animate-flare fill-destructive opacity-0"
        />
      ) : null}
      {rim === undefined ? null : (
        <polygon
          points={points(hex)}
          fill="none"
          stroke={rim.color}
          strokeDasharray={rim.dash}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      )}
      <polygon
        points={points(hex)}
        fill="none"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        className={cn(
          'stroke-ring transition-opacity duration-200',
          held === 'focused' ? 'opacity-100' : 'opacity-0 group-focus-visible:opacity-100',
        )}
      />
    </>
  )
}

/** The lights behind it: the root's halo, the draft's breathing violet, and the blur they glow by. */
function Glows({ hex, kind, id }: TileProps & { id: string }) {
  return (
    <>
      <defs>
        <radialGradient id={`${id}-halo`}>
          <stop offset="0" style={{ stopColor: tint('halo', 50) }} />
          <stop offset=".42" style={{ stopColor: tint('halo', 30) }} />
          <stop offset=".7" style={{ stopColor: tint('halo', 8) }} />
          <stop offset="1" style={{ stopColor: tint('halo', 0) }} />
        </radialGradient>
        <BlurDef id={`${id}-blur`} />
      </defs>
      {kind === 'root' ? (
        <circle
          cx={hex.center.x}
          cy={hex.center.y}
          r={hex.radius * 1.45}
          fill={`url(#${id}-halo)`}
          className="pointer-events-none"
        />
      ) : null}
      {kind === 'draft' ? (
        <polygon
          points={points(scaled(hex, 0.85))}
          filter={`url(#${id}-blur)`}
          className="pointer-events-none fill-agent opacity-26 motion-safe:animate-breathe"
        />
      ) : null}
    </>
  )
}

/** A Branch's frame in small, at its foot: its heart, and a dot lit where each child is. */
function Foot({ hex, kids, scale }: { hex: Hex; kids: readonly Direction[]; scale: number }) {
  const { center, radius } = hex
  // Its dots between 2.3 and 3.6px on screen.
  const dot = Math.min(3.6, Math.max(2.3, radius * scale * 0.034)) / scale
  const heart = { x: center.x, y: center.y + radius * 0.84 - dot * 3.3 }
  const ring = { center: heart, radius: dot * 1.12 }
  return (
    <g aria-hidden className="pointer-events-none">
      <polygon
        points={points({ center: heart, radius: dot })}
        style={{ fill: tint('foreground', 20) }}
      />
      {directions.map((direction) => (
        <polygon
          key={direction}
          points={points({ center: neighbor(ring, direction).center, radius: dot })}
          style={{ fill: tint('foreground', kids.includes(direction) ? 45 : 9) }}
        />
      ))}
    </g>
  )
}

const kindNames: Record<TileKind, () => string> = {
  root: m.tile_kind_root,
  untitled: m.tile_kind_untitled,
  branch: m.tile_kind_branch,
  leaf: m.tile_kind_leaf,
  context: m.tile_kind_context,
  reference: m.tile_kind_reference,
  broken: m.tile_kind_broken,
  draft: m.tile_kind_draft,
  list: m.tile_kind_list,
}

/**
 * Its words, in the box its size on screen gives them (`fitWords`): the title, in italics at the
 * center, alone on a small tile; on a larger one the preview below it, as many lines as fit, then the
 * word under them.
 */
function Words(props: TileProps & { sized: Sized }) {
  const { hex, kind, words, place = 'ring', sized } = props
  const alone = sized.preview === undefined
  const label = useRef<HTMLDivElement>(null)
  const lines = usePreviewLines(label)
  return (
    <foreignObject
      x={hex.center.x - sized.width / 2}
      y={hex.center.y - sized.height / 2}
      width={sized.width}
      height={sized.height}
      className="pointer-events-none overflow-visible"
    >
      <div
        ref={label}
        aria-hidden
        className="flex size-full flex-col items-center justify-center overflow-hidden text-center hyphens-auto text-foreground select-none"
        style={{ fontSize: sized.title }}
      >
        <span className={titleClass(props, alone)}>{words.title}</span>
        {!alone && words.preview ? (
          <span
            data-preview
            className={cn(
              'mt-[.7em] max-w-[90%] shrink-0 overflow-hidden font-sans font-light leading-[1.4] text-muted-foreground',
              (place === 'center' || kind === 'root') && 'text-foreground/80',
            )}
            style={{
              fontSize: sized.preview,
              display: lines === 0 ? 'none' : '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: lines,
            }}
          >
            {words.preview}
          </span>
        ) : null}
        {alone ? null : <Below {...props} />}
      </div>
    </foreignObject>
  )
}

/** The title's type: the human's serif, a file's mono, the agent's for its draft, faint for none yet. */
function titleClass(look: TileLook & { place?: TilePlace }, alone: boolean): string {
  const { kind } = look
  return cn(
    'max-w-full shrink-0 font-human leading-[1.15] break-words',
    alone ? 'line-clamp-2' : 'line-clamp-3',
    look.place === 'center' && 'italic',
    kind === 'leaf' && look.file === true && 'font-mono text-[.8em]',
    kind === 'draft' && 'font-agent text-[.86em] text-agent',
    (kind === 'broken' || kind === 'untitled') && 'text-faint italic',
  )
}

/** What sits under the title and the preview: a ring too full's names, then the word under them. */
function Below(look: TileLook) {
  const note = noteOf(look)
  return (
    <>
      {look.kind === 'list' ? (
        <span className="mt-[.7em] shrink-0 font-mono text-[.6em] leading-[1.55] text-muted-foreground">
          {look.names.map((name) => (
            <span key={name} className="block">
              {name}
            </span>
          ))}
        </span>
      ) : null}
      {note === undefined ? null : (
        <span
          className={cn(
            'mt-[.75em] max-w-full shrink-0 font-agent text-[.6em] leading-[1.3] text-balance',
            note.tone,
          )}
        >
          {look.kind === 'reference' ? (
            <Link aria-hidden className="mr-[.45em] inline size-[1.15em] align-[-0.2em]" />
          ) : null}
          {note.text}
        </span>
      )}
    </>
  )
}

/**
 * How many lines of the preview the box holds under what sits above it: measured after every render,
 * since anything drawn beside the preview may have changed its height, and again once the fonts have
 * loaded; unknown before the first layout, where the box clips them.
 */
function usePreviewLines(label: RefObject<HTMLDivElement | null>): number | undefined {
  const [lines, setLines] = useState<number>()
  const measure = () => {
    const box = label.current
    const preview = box?.querySelector<HTMLElement>('[data-preview]')
    if (!box || !preview) return
    const style = getComputedStyle(preview)
    const above = [...box.children]
      .filter((child) => child !== preview)
      .reduce(
        (sum, child) =>
          sum + (child as HTMLElement).offsetHeight + parseFloat(getComputedStyle(child).marginTop),
        parseFloat(style.marginTop),
      )
    setLines(
      linesThatFit({ box: box.clientHeight, above, lineHeight: parseFloat(style.lineHeight) }),
    )
  }
  useLayoutEffect(measure)
  // Once: the fonts load a single time, and every later render measures on its own.
  useLayoutEffect(() => {
    let live = true
    void document.fonts.ready.then(() => {
      if (live) measure()
    })
    return () => {
      live = false
    }
  }, [])
  return lines
}
