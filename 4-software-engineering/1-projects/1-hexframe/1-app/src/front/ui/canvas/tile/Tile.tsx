// A tile, drawn by its light alone (HEX-104's proposal; HEX-106 puts it on the canvas in place of
// ../Tile.tsx). What it is, where it stands, what happens to it and who touches it change that
// light, and never add a box: a Branch fades toward its foot, where its frame shows in small; a Leaf
// is lit evenly; the Context is teal; the root, the only warm tile, is you. Under the pointer the
// light rises; the keyboard's focus is the ring's amber line; the center keeps the one steady line.
// A write still on its way sweeps a light over it; refused, it flares and its caller puts it back.
// Its words are fitted to its size on screen (words.ts). It is an SVG group, drawn inside the
// canvas's <svg> at its hex, and a button when its caller says what a click does.
import { Link } from 'lucide-react'
import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { cn } from 'cn'

import { m } from '#/paraglide/messages'

import { directions, neighbor, type Direction, type Hex, type Point } from '../geometry/geometry'
import { buttonKeys } from '../keys'
import { BlurDef, FadeDef, points, scaled, Sweep, tint, type Fade } from './light'
import { fitWords, linesThatFit, type Fit } from '../geometry/words'

/** What a tile is, which its light says before its words do. */
export type TileKind =
  'root' | 'untitled' | 'branch' | 'leaf' | 'context' | 'reference' | 'broken' | 'draft' | 'list'

/**
 * Where it stands: in a ring, at the center, at the heart of a Branch opened in place, beside the
 * frame, or further out.
 */
type TilePlace = 'ring' | 'center' | 'heart' | 'near' | 'far'

/** A state the hand gives, held without it: on /design-system, or by whatever points at the tile. */
type Held = 'pointed' | 'focused' | 'pressed'

/** A write on the tile, still on its way or refused. */
type TileWrite = 'pending' | 'refused'

/** Blooming out of its parent's heart, or folding back into it, `delay` ms after its elder. */
export interface TileMotion {
  way: 'bloom' | 'fold'
  from: Point
  delay?: number
}

/** A tile's words: its title, its preview, a word under them, and a ring too full's names. */
export interface TileWords {
  title: string
  preview?: string
  /** Where a Reference lives, that a Reference is broken, that the agent drafts it. */
  note?: string
  names?: readonly string[]
}

export interface TileProps {
  hex: Hex
  kind: TileKind
  words: TileWords
  /** The Directions its children hold, drawn small at a Branch's or the root's foot. */
  foot?: readonly Direction[]
  /** A Leaf that isn't Markdown: its title is its file's name, in mono. */
  file?: boolean
  /** What the shape couldn't seat as asked, in ember under the title. */
  clash?: string
  place?: TilePlace
  write?: TileWrite
  held?: Held
  motion?: TileMotion
  /** What a click does, and its name for a screen reader; without it, the tile is no button. */
  action?: { label: string; onSelect: () => void }
  /** Screen px per unit of the hex, so the words fit the tile's size on screen. 1 by default. */
  scale?: number
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
  const { hex, kind, words, place = 'ring', write, held, motion, action } = props
  const id = useId()
  const pending = write === 'pending'
  const description = [
    kindNames[kind](),
    words.note,
    props.clash,
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
      style={motion && origin(motion.from, motion.delay)}
    >
      <g
        {...(action === undefined
          ? { role: 'img', 'aria-label': words.title }
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
          {pending ? <Sweep hex={hex} /> : null}
          <Words {...props} />
        </g>
      </g>
    </g>
  )
}

/** Where a transform starts, in the canvas's own coordinates, and after how long. */
function origin({ x, y }: Point, delay?: number): CSSProperties {
  return {
    transformOrigin: `${String(x)}px ${String(y)}px`,
    transformBox: 'view-box',
    ...(delay !== undefined && { animationDelay: `${String(delay)}ms` }),
  }
}

/** Its line of its own, if any: a clash's ember, its kind's hairline, or the center's steady line. */
function rimOf({ kind, clash, place = 'ring' }: TileProps, id: string): Rim | undefined {
  if (clash !== undefined) return ember
  const own = rims[kind]
  if (own !== undefined || place !== 'center') return own
  return { color: kind === 'root' || kind === 'untitled' ? `url(#${id}-rim)` : 'var(--input)' }
}

/** Its fill, lit or not, its lines, the lights around it, and its frame in small at its foot. */
function Light(props: TileProps & { id: string }) {
  const { hex, kind, foot, place = 'ring', held, action, scale = 1, id } = props
  const lit = place === 'center' || place === 'heart' || held === 'pointed' || held === 'pressed'
  const rim = rimOf(props, id)
  const showsFoot =
    (kind === 'branch' || kind === 'root') &&
    place !== 'center' &&
    place !== 'heart' &&
    hex.radius * scale >= 72
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
      {showsFoot && foot !== undefined ? <Foot hex={hex} kids={foot} unit={1 / scale} /> : null}
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
function Foot({ hex, kids, unit }: { hex: Hex; kids: readonly Direction[]; unit: number }) {
  const { center, radius } = hex
  const dot = Math.min(3.6, Math.max(2.3, (radius / unit) * 0.034)) * unit
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

const noteTones: Partial<Record<TileKind, string>> = {
  reference: 'text-context',
  draft: 'text-agent',
}

/**
 * Its words, in the box its size gives them: the title always, in italics at the center; under a
 * radius of 72 on screen, alone; otherwise the preview below it, as many lines as fit, then the word
 * under them. Under a radius of 30, none: the tile is its light, and its name is for a screen reader.
 */
function Words({ hex, kind, words, file, clash, place = 'ring', scale = 1 }: TileProps) {
  const fit = fitWords(hex.radius * scale)
  if (fit === undefined) return null
  return <Fitted {...{ hex, kind, words, file, clash, place, scale, fit }} />
}

/** Its words, once its size gives them a box. */
function Fitted({
  hex,
  kind,
  words,
  file,
  clash,
  place,
  scale,
  fit,
}: TileProps & { place: TilePlace; scale: number; fit: Fit }) {
  const alone = fit.preview === undefined
  const label = useRef<HTMLDivElement>(null)
  const lines = usePreviewLines(
    label,
    [words.title, words.preview, words.note, clash, fit.title].join('|'),
  )
  const width = fit.width / scale
  const height = fit.height / scale
  return (
    <foreignObject
      x={hex.center.x - width / 2}
      y={hex.center.y - height / 2}
      width={width}
      height={height}
      className="pointer-events-none overflow-visible"
    >
      <div
        ref={label}
        aria-hidden
        className="flex size-full flex-col items-center justify-center overflow-hidden text-center hyphens-auto text-foreground select-none"
        style={{ fontSize: fit.title / scale }}
      >
        <span className={titleClass({ kind, file, place, alone })}>{words.title}</span>
        {!alone && words.preview ? (
          <span
            data-preview
            className={cn(
              'mt-[.7em] max-w-[90%] shrink-0 overflow-hidden font-sans font-light leading-[1.4] text-muted-foreground',
              (place === 'center' || kind === 'root') && 'text-foreground/80',
            )}
            style={{
              fontSize: (fit.preview ?? 0) / scale,
              display: lines === 0 ? 'none' : '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: lines,
            }}
          >
            {words.preview}
          </span>
        ) : null}
        {alone ? null : <Below kind={kind} words={words} clash={clash} />}
      </div>
    </foreignObject>
  )
}

/** The title's type: the human's serif, a file's mono, the agent's for its draft, faint for none yet. */
function titleClass({
  kind,
  file,
  place,
  alone,
}: Pick<TileProps, 'kind' | 'file' | 'place'> & { alone: boolean }): string {
  return cn(
    'max-w-full shrink-0 font-human leading-[1.15] break-words',
    alone ? 'line-clamp-2' : 'line-clamp-3',
    place === 'center' && 'italic',
    file === true && 'font-mono text-[.8em]',
    kind === 'draft' && 'font-agent text-[.86em] text-agent',
    (kind === 'broken' || kind === 'untitled') && 'text-faint italic',
  )
}

/** What sits under the title and the preview: a ring too full's names, then the word under them. */
function Below({ kind, words, clash }: Pick<TileProps, 'kind' | 'words' | 'clash'>) {
  const note = clash ?? words.note
  return (
    <>
      {words.names ? (
        <span className="mt-[.7em] shrink-0 font-mono text-[.6em] leading-[1.55] text-muted-foreground">
          {words.names.map((name) => (
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
            clash === undefined ? (noteTones[kind] ?? 'text-faint') : 'text-warning',
          )}
        >
          {kind === 'reference' ? (
            <Link aria-hidden className="mr-[.45em] inline size-[1.15em] align-[-0.2em]" />
          ) : null}
          {note}
        </span>
      )}
    </>
  )
}

/**
 * How many lines of the preview the box holds under what sits above it, measured once laid out and
 * again once the fonts have loaded; unknown before the first layout, where the box clips them.
 */
function usePreviewLines(
  label: RefObject<HTMLDivElement | null>,
  content: string,
): number | undefined {
  const [lines, setLines] = useState<number>()
  useLayoutEffect(() => {
    const measure = () => {
      const box = label.current
      const preview = box?.querySelector<HTMLElement>('[data-preview]')
      if (!box || !preview) return
      const style = getComputedStyle(preview)
      const above = [...box.children]
        .filter((child) => child !== preview)
        .reduce(
          (sum, child) =>
            sum +
            (child as HTMLElement).offsetHeight +
            parseFloat(getComputedStyle(child).marginTop),
          parseFloat(style.marginTop),
        )
      setLines(
        linesThatFit({ box: box.clientHeight, above, lineHeight: parseFloat(style.lineHeight) }),
      )
    }
    let live = true
    measure()
    void document.fonts.ready.then(() => {
      if (live) measure()
    })
    return () => {
      live = false
    }
  }, [label, content])
  return lines
}
