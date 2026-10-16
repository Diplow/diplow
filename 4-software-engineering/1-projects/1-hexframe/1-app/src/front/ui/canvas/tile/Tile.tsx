// A tile, drawn by its light alone (HEX-104's proposal, on the canvas since HEX-106). What it is,
// where it stands, what happens to it and who touches it change that light, and never add a box: a
// Branch fades toward its foot, where its frame shows in small; a Leaf is lit evenly; the Context
// is teal; the root, the only warm tile, is you. Under the pointer the light rises; the keyboard's
// focus is the ring's amber line; the center keeps the one steady line. A write still on its way
// sweeps a light over it; refused, it flares and its caller puts it back. Who touches it marks it
// (`marks/`, HEX-108): the chat pointing at it, the agent at work, a change you haven't seen, what a
// Proposal would do; a tile being written breathes in its writer's voice, and one a Proposal would
// create waits as a ghost. Its words are fitted to its size on screen (words.ts). It is an SVG
// group, drawn inside the canvas's <svg> at its hex, and a button when its caller says what a click
// does.
import { Link } from 'lucide-react'
import { Slot } from 'radix-ui'
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type RefObject,
} from 'react'
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
import { BlurDef, FadeDef, points, proposedRim, Sweep, tint, type Fade } from './light'
import { fitAlone, fitWords, linesThatFit } from '../geometry/words'
import { MarkGlow, MarkLines } from './marks/Marks'
import { markNote, type TileMark } from './marks/mark'

/**
 * Where it stands: in a ring, at the center, alone at the center, folded, its words read rather than
 * glanced at, at the heart of a Branch opened in place, beside the frame, or further out.
 */
export type TilePlace = 'ring' | 'center' | 'alone' | 'heart' | 'near' | 'far'

/** At the center, folded or open: lit, its one steady line, its title in italics. */
const centered = (place: TilePlace) => place === 'center' || place === 'alone'

/** A state the hand gives, held without it: on /design-system, or by whatever points at the tile. */
type Held = 'pointed' | 'focused' | 'pressed'

/** A write on the tile, still on its way or refused. */
export type TileWrite = 'pending' | 'refused'

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
  /** The agent's draft, breathing violet in its slot. */
  | { kind: 'draft' }
  /** A tile you are writing in the tile widget, not there yet: breathing in your amber. */
  | { kind: 'writing' }
  /** A tile an open Proposal would create, not there yet: a ghost, with no menu of its own. */
  | { kind: 'ghost' }
  | { kind: 'untitled' | 'context' | 'broken' }
)

/**
 * A tile standing in a free slot before it is there, the agent's draft, one you write or one a
 * Proposal would create: no Tile of the System is drawn so.
 */
export type StandingLook = Extract<TileLook, { kind: 'draft' | 'writing' | 'ghost' }>

type TileKind = TileLook['kind']

export type TileProps = TileLook & {
  hex: Hex
  place?: TilePlace
  write?: TileWrite
  held?: Held
  motion?: TileMotion
  /** What a click does, and its name for a screen reader; without it, the tile is no button. */
  action?: Action
  /**
   * Going in, centering the tile: a double click or ⇧↵, on a tile that is a button. Without it, both
   * are left to what listens around the tile, its menu.
   */
  onGoIn?: (from: 'pointer' | 'keyboard') => void
  /** Screen px per unit of the hex, so the words fit the tile's size on screen. 1 by default. */
  scale?: number
  /** What its menu and its hover card hand it; a tile handed them takes the focus, a button or not. */
  hand?: Hand
  /** Who touches it: the chat pointing at it, the agent at work, a change unseen, a Proposal. */
  mark?: TileMark | undefined
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
    case 'writing':
      return { text: m.tile_writing(), tone: 'text-human' }
    case 'ghost':
      return { text: m.tile_proposed(), tone: 'text-agent' }
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

function sizedOf(hex: Hex, scale: number, place: TilePlace): Sized | undefined {
  const fit = (place === 'alone' ? fitAlone : fitWords)(hex.radius * scale)
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
  // Untitled, it has no colour of its own yet, its lamp alone: the root's warm light, none of it.
  untitled: { rest: warm(0, 0), lit: warm(0, 0) },
  branch: tile,
  list: tile,
  leaf: {
    rest: evenly(between('tile', 'tile-fade', 55)),
    lit: evenly(between('tile-lit', 'tile-lit-fade', 60)),
  },
  context: teal,
  reference: teal,
  broken: { rest: evenly('transparent'), lit: evenly(tint('foreground', 4)) },
  draft: drafted('agent'),
  writing: drafted('human'),
  ghost: { rest: evenly(tint('agent', 6)), lit: evenly(tint('agent', 11)) },
}

/** A tile being written, lit in its writer's voice from its top. */
function drafted(voice: 'agent' | 'human'): Lights {
  return {
    rest: { top: tint(voice, 14), foot: tint(voice, 0) },
    lit: { top: tint(voice, 22), foot: tint(voice, 4) },
  }
}

/** A line of its own: the Context's hairline, dashed where it is not done or not there. */
interface Rim {
  color: string
  dash?: string
  /** Not lit yet: the untitled root's, which lights as its light rises. */
  unlit?: boolean
}

const ember: Rim = { color: tint('warning', 60) }

const rims: Partial<Record<TileKind, Rim>> = {
  context: { color: tint('context', 45) },
  reference: { color: tint('context', 45), dash: '3 3' },
  broken: { color: tint('faint', 70), dash: '2 4' },
  list: ember,
  // What a Proposal would create: dashed violet, since it isn't done yet.
  ghost: proposedRim,
}

const opacities: Record<TilePlace, string> = {
  ring: '',
  center: '',
  alone: '',
  heart: '',
  near: 'opacity-50',
  far: 'opacity-13',
}

export function Tile(props: TileProps) {
  const { hex, place = 'ring', write, held, motion, action, onGoIn } = props
  const { scale = 1, hand, mark } = props
  const id = useId()
  const pending = write === 'pending'
  const sized = sizedOf(hex, scale, place)
  // At the center and at a heart, the ring around it says what the foot would; elsewhere the foot
  // comes with the preview, once there is room for more than the title, alone at the center too,
  // where it says what opening it shows.
  const foot =
    place === 'center' || place === 'heart' || sized?.preview === undefined
      ? undefined
      : footOf(props)
  const description = [
    kindNames[props.kind](),
    noteOf(props)?.text,
    markNote(mark)?.text,
    pending ? m.tile_write_pending() : undefined,
    write === 'refused' ? m.tile_write_refused() : undefined,
  ]
    .filter(Boolean)
    .join(', ')
  return (
    <g
      className={cn(
        'transition-opacity duration-450',
        // A deletion proposed: the tile steps back, as what is going away, unless it is far already.
        mark?.proposed === 'delete' && place !== 'far' ? 'opacity-40' : opacities[place],
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
                'aria-label': nameOf(props),
                ...(hand && { tabIndex: 0, className: 'group outline-none' }),
              }
            : pressable(action, onGoIn))}
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

/** Its name for a screen reader: its title, or its kind's where its hex says nothing, untitled. */
const nameOf = ({ kind, words }: TileLook) => (words.title === '' ? kindNames[kind]() : words.title)

/**
 * What makes it a button: its name, a click, Enter and Space, and going in where its caller says, by
 * a double click, the second click of which does nothing more, or by ⇧↵.
 */
function pressable(action: Action, onGoIn: TileProps['onGoIn']) {
  return {
    role: 'button',
    tabIndex: 0,
    'aria-label': action.label,
    className: 'group cursor-pointer outline-none',
    onClick: (event: MouseEvent) => {
      if (onGoIn === undefined || event.detail < 2) action.onSelect()
    },
    ...(onGoIn && {
      onDoubleClick: () => {
        onGoIn('pointer')
      },
    }),
    ...buttonKeys({
      onEnter: action.onSelect,
      onSpace: action.onSelect,
      ...(onGoIn && {
        onShiftEnter: () => {
          onGoIn('keyboard')
        },
      }),
    }),
  }
}

/** Where a transform starts, in the canvas's own coordinates, and how many siblings it waits for. */
function origin({ x, y }: Point, order?: number): CSSProperties {
  return {
    transformOrigin: `${String(x)}px ${String(y)}px`,
    transformBox: 'view-box',
    ...(order !== undefined && { animationDelay: `calc(var(--stagger-bloom) * ${String(order)})` }),
  }
}

/**
 * Its line of its own, if any: a clash's ember, its kind's hairline, or the center's steady line; the
 * untitled root's unlit, since it is not there yet but for its lamp.
 */
function rimOf(props: TileProps, id: string): Rim | undefined {
  const { kind, place = 'ring' } = props
  if (clashOf(props) !== undefined) return ember
  const own = rims[kind]
  if (own !== undefined || !centered(place)) return own
  if (rises(kind)) return { color: `url(#${id}-rim)`, unlit: kind === 'untitled' }
  return { color: 'var(--input)' }
}

/** Its fill, lit or not, its lines, and the lights around it. */
function Light(props: TileProps & { id: string }) {
  const { hex, place = 'ring', held, action, hand, id, mark, scale = 1 } = props
  const lit =
    centered(place) ||
    place === 'heart' ||
    held === 'pointed' ||
    held === 'pressed' ||
    mark?.pointed === 'tile'
  const rim = rimOf(props, id)
  return (
    <>
      <defs>
        <FadeDef id={`${id}-rest`} fade={lights[props.kind].rest} rising={rises(props.kind)} />
        <FadeDef id={`${id}-lit`} fade={lights[props.kind].lit} rising={rises(props.kind)} />
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
          // Its menu open, it stays lit: Radix marks what opened it.
          hand !== undefined && 'group-data-[state=open]:opacity-100',
        )}
      />
      {/* Over the fill, as the flare: on paper a fill nearly white would hide a light behind it. */}
      <MarkGlow hex={hex} mark={mark} blur={`${id}-blur`} />
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
          className={cn(
            'transition-opacity duration-(--duration-sunrise) ease-glide motion-reduce:transition-none',
            rim.unlit === true && 'opacity-0',
          )}
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
      <MarkLines hex={hex} mark={mark} scale={scale} />
    </>
  )
}

/**
 * Whether its light rises as it changes: the root's, small and faint while untitled, which grows to
 * its glow and lightens once the user names it, for `--duration-sunrise`.
 */
const rises = (kind: TileKind) => kind === 'root' || kind === 'untitled'

/**
 * The lights behind it: the root's halo, small while it is untitled, a draft breathing in its
 * writer's voice, and the blur they, and who touches it, glow by.
 */
function Glows(props: TileProps & { id: string }) {
  const { hex, kind, id } = props
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
      {rises(kind) ? (
        <circle
          cx={hex.center.x}
          cy={hex.center.y}
          r={hex.radius * 1.45}
          fill={`url(#${id}-halo)`}
          className={cn(
            'pointer-events-none transition-[scale,opacity] duration-(--duration-sunrise) ease-glide motion-reduce:transition-none',
            kind === 'untitled' && 'scale-[.28] opacity-75',
          )}
          style={origin(hex.center)}
        />
      ) : null}
      {kind === 'draft' || kind === 'writing' ? (
        <polygon
          points={points(scaled(hex, 0.85))}
          filter={`url(#${id}-blur)`}
          className={cn(
            'pointer-events-none opacity-26 motion-safe:animate-breathe',
            kind === 'writing' ? 'fill-human' : 'fill-agent',
          )}
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
  writing: m.tile_kind_draft_yours,
  ghost: m.tile_kind_ghost,
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
              (centered(place) || kind === 'root') && 'text-foreground/80',
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

/**
 * The title's type: the human's serif, the untitled root's pseudo as it is typed included, a file's
 * mono, the agent's for its draft, faint for a broken Reference.
 */
function titleClass(look: TileLook & { place?: TilePlace }, alone: boolean): string {
  const { kind } = look
  return cn(
    'max-w-full shrink-0 font-human leading-[1.15] break-words',
    alone ? 'line-clamp-2' : 'line-clamp-3',
    look.place !== undefined && centered(look.place) && 'italic',
    kind === 'leaf' && look.file === true && 'font-mono text-[.8em]',
    // The agent's words are its mono, a draft it writes or a tile it proposes; yours keep your serif.
    (kind === 'draft' || kind === 'ghost') && 'font-agent text-[.86em] text-agent',
    kind === 'broken' && 'text-faint italic',
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
