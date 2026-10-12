// The canvas's hexes where they can be acted on (HEX-105's proposal, on the canvas since HEX-107): a
// Tile in its menu and its hover card, dragged under a mouse or a pen, lifted while it moves, the
// others stepping back, a Branch offering its swap; a free slot in its menu, or offering itself to the
// tile on the move. What each line and each place does is the caller's; the canvas runs the lines
// that go somewhere, and the move's gestures through `useMove`.
import type { PointerEvent, ReactElement } from 'react'

import type { EmptySlotTarget } from './geometry/shape'
import type { Action, Hand } from './keys'
import type { Target } from './state/move/useMove'
import { isViewVerb, type TileHex, type ViewVerb } from './state/useCanvasState'
import { TileMenu } from './tile/menu/TileMenu'
import type { PickerFrame } from './tile/menu/Picker'
import { groupsOf, type Subject, type TileAct, type Verb } from './tile/menu/verbs'
import { markNote, type TileMark } from './tile/marks/mark'
import { Aside, LandingSlot, Lifted, SwapDisc } from './tile/moving/Moving'
import { Slot } from './tile/places'
import type { TileNode } from './view/tiles'
import { cardOf, type CardWords } from './view/looks'
import type { TileLook } from './tile/Tile'

/** What a Tile's or a free slot's menu says of it, and what its lines do. */
export interface Acting {
  subject: Subject
  /** The frames its place submenus draw: the one it holds, the one it stands in. */
  frames?: { holds?: PickerFrame; standsIn?: PickerFrame }
  /** The lines its caller can't run, left out. */
  without?: readonly Verb[]
  /** A chosen line that goes nowhere: the caller's. Open, Go in, Show its Context and Back out are the canvas's. */
  onAct: (act: TileAct, said: string) => void
}

/** A Tile on the move, and which Tiles offer to trade places with it. */
export interface Moving {
  /** Its id, the URL's on home. */
  id: string
  title: string
  /** Whether a Tile offers to trade places with it, how that is named and what it does. */
  swapTargets: (tile: TileNode) => Action | undefined
}

/** A place the tile on the move lands on, and its name for a screen reader. */
export type Landing = Target & { label: string }

/** Whether a subject's menu lets it move, and so a mouse drag it. */
const moves = ({ subject, without = [] }: Acting) =>
  !without.includes('move') && groupsOf(subject).some((group) => group.includes('move'))

/** A Reference is drawn under its Tile's id, which stands elsewhere: it is never the one moving. */
export const standsFor = (hex: TileHex, id: string | undefined) =>
  hex.tile.id === id && hex.tile.reference === undefined

/** What the canvas hands a Tile's hex: its acting, the move, the gestures, how it is drawn. */
export interface TileHexProps {
  hex: TileHex
  look: TileLook
  /** The Tile, as the canvas draws it: handed what its menu and its card need of it, if it has one. */
  draw: (hand?: Hand) => ReactElement
  /** Who touches it, which its card says before anything else it would note. */
  mark: TileMark | undefined
  acting: Acting | undefined
  /** The line of its menu that goes somewhere, which the canvas runs. */
  go: (verb: ViewVerb) => void
  moving: Moving | undefined
  /** Another hex's menu is open: this one steps back. */
  aside: boolean
  onMenu: (open: boolean) => void
  /** What the move's hook says of this Tile. */
  shift: { by: { x: number; y: number }; glides: boolean }
  /** No landing may start: its tile is in the air. */
  inTheAir: boolean
  /** The swap it offers the tile on the move, if it does. */
  swap: Landing | undefined
  over: boolean
  scale: number
  tileRef: (element: Element | null) => void
  press: (event: PointerEvent) => void
  land: (target: Target) => void
}

/** A Tile's card, its own notes, then what lasts of who touches it where something does. */
function markedCard(card: CardWords, mark: TileMark | undefined): CardWords {
  const note = markNote(mark)
  return note === undefined ? card : { ...card, notes: [...(card.notes ?? []), note] }
}

/**
 * A Tile's hex: in its menu and its hover card, where its caller acts; lifted while it moves, or
 * offering its swap, or stepped back, still answering its click, so the canvas can be taken anywhere
 * meanwhile; gliding as it lands.
 */
export function TileHexView(props: TileHexProps) {
  const { hex, look, draw, acting, moving, shift, scale, swap } = props
  const self = standsFor(hex, moving?.id)
  const aside = moving === undefined ? props.aside : !self && swap === undefined
  const drags = acting !== undefined && moves(acting) && hex.tile.reference === undefined
  return (
    <g
      ref={hex.tile.reference === undefined ? props.tileRef : undefined}
      style={{ transform: `translate(${String(shift.by.x)}px, ${String(shift.by.y)}px)` }}
      className={
        shift.glides
          ? 'transition-transform duration-(--duration-glide) ease-glide motion-reduce:transition-none'
          : undefined
      }
      onPointerDown={drags ? props.press : undefined}
    >
      <Aside aside={aside} reachable={moving !== undefined}>
        <Lifted hex={hex.hex} lifted={self}>
          {acting === undefined ? (
            draw()
          ) : (
            <TileMenu
              subject={acting.subject}
              card={markedCard(cardOf(look), props.mark)}
              {...(acting.frames && { frames: acting.frames })}
              {...(acting.without && { without: acting.without })}
              onOpenChange={props.onMenu}
              onAct={(act, said) => {
                if (isViewVerb(act.verb)) props.go(act.verb)
                else acting.onAct(act, said)
              }}
            >
              {draw}
            </TileMenu>
          )}
        </Lifted>
      </Aside>
      {swap === undefined || props.inTheAir ? null : (
        <SwapDisc
          hex={hex.hex}
          scale={scale}
          over={props.over}
          action={{
            label: swap.label,
            onSelect: () => {
              props.land(swap)
            },
          }}
        />
      )}
    </g>
  )
}

/** What the canvas hands a free slot: what a click there does, its menu, and the move. */
export interface SlotHexProps {
  hex: { key: string; hex: TileHex['hex']; slot: EmptySlotTarget }
  action: Action | undefined
  /** Where the tile on the move lands in it, if it does. */
  landing: Landing | undefined
  loading: boolean
  acting: Acting | undefined
  moving: boolean
  inTheAir: boolean
  over: boolean
  onMenu: (open: boolean) => void
  land: (target: Target) => void
}

/**
 * A free slot: in its menu, a click adding a tile there; while a tile moves, offering itself where
 * it takes the tile, dotted where it doesn't.
 */
export function SlotHexView(props: SlotHexProps) {
  const { hex, action, acting, landing } = props
  if (props.moving) {
    if (landing === undefined || props.inTheAir) {
      return <Slot hex={hex.hex} loading={props.loading} />
    }
    return (
      <LandingSlot
        hex={hex.hex}
        over={props.over}
        action={{
          label: landing.label,
          onSelect: () => {
            props.land(landing)
          },
        }}
      />
    )
  }
  if (acting === undefined || action === undefined) {
    return <Slot hex={hex.hex} action={action} loading={props.loading} />
  }
  return (
    <TileMenu
      subject={acting.subject}
      {...(acting.without && { without: acting.without })}
      onOpenChange={props.onMenu}
      onAct={acting.onAct}
    >
      {(hand) => <Slot hex={hex.hex} action={action} loading={props.loading} hand={hand} />}
    </TileMenu>
  )
}
