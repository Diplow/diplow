// The canvas's end of each crossing on /design-system (HEX-108), on the fixture System: a tile as the
// chat names it, with what its card says; the Tiles the composer's `@` finds; what each tile's menu
// says of it; what the canvas marks as the agent's Turn goes, while its Proposal is open and while a
// tile is written; and a frame whose tiles carry off it, for the composer to name. `ui/crossings.tsx`
// joins each to the chat's end (`ui/chat/crossings.tsx`), the one module of `ui/` importing both sides.
import { useRef, useState, type ComponentProps } from 'react'

import { m } from '#/paraglide/messages'

import { Canvas, type CanvasMarks, type Standing } from './Canvas'
import { tooling, ulysse } from './fixtures'
import { directions, neighbor, type Direction, type Hex, type Point } from './geometry/geometry'
import type { EmptySlotTarget } from './geometry/shape'
import type { TileHex } from './state/useCanvasState'
import { useScale } from './state/useScale'
import type { TileMark } from './tile/marks/mark'
import { directionName, placeOf, type Subject } from './tile/menu/verbs'
import { unitsIn, useDrag } from './tile/moving/drag'
import { Carried, Lifted } from './tile/moving/Moving'
import { Slot } from './tile/places'
import { frameHeight, frameRadius, frameWidth, gap, ring } from './tile/specimens'
import { Tile, type TileLook } from './tile/Tile'
import { lookOf } from './view/looks'
import { findTile, pathTo, type TileNode } from './view/tiles'
import type { CanvasView } from './view/view'

/** The tile the crossings start centered on, and the view they open on. */
export const engineering = 'software-engineering'
export const startView: CanvasView = { center: engineering }

/** A Tile of the fixture's title, by its id; the root's for none. */
export const titleOf = (id: string | undefined) =>
  findTile(ulysse, id ?? ulysse.id)?.title ?? ulysse.title

/** The canvas at a crossing's end, on the fixture System unless the crossing changed it. */
export function CrossingCanvas({
  system = ulysse,
  ...canvas
}: Omit<ComponentProps<typeof Canvas>, 'system' | 'className'> & { system?: TileNode }) {
  return <Canvas system={system} {...canvas} className="h-[28rem] w-[35rem] max-w-full" />
}

/** A tile a crossing glinted on in your amber, keyed so another glint rises again. */
export interface Glint {
  id: string
  key: number
}

/** The marks of a glint on its tile; none on the others. */
export const glinting =
  (glint: Glint | undefined) =>
  (id: string): TileMark | undefined =>
    glint?.id === id ? { glint: { by: 'human', key: glint.key } } : undefined

type Ring = 'branches' | 'leaves' | 'context'

/** The ring of `parent` a Tile stands in, and its Direction there. */
function seatOf(parent: TileNode, id: string): [Ring, Direction] | undefined {
  for (const ring of ['branches', 'leaves', 'context'] as const) {
    const at = directions.find((direction) => parent[ring]?.[direction]?.id === id)
    if (at !== undefined) return [ring, at]
  }
  return undefined
}

/** Whether a tile of the fixture takes a new one: one of its six places is free. */
const holdsIn = (tile: TileNode) =>
  directions.some(
    (direction) =>
      tile.branches?.[direction] === undefined && tile.leaves?.[direction] === undefined,
  )

/**
 * What a Tile's menu and card say of where it stands, as the canvas would draw it, `center` where it
 * is centered. The fixture's reading of what home asks Mapping through `features/system/acting.ts`'s
 * `subjectOf`, which rules on Mapping's own System, as the fixture is not: a Branch or the root takes
 * a new tile where one of its six places is free; nothing turns into the other kind, nor counts what
 * is below it, which only Mapping says.
 */
function subjectIn(system: TileNode, id: string, center = false): Subject | undefined {
  const path = pathTo(system, id)
  const tile = path.at(-1)
  const parent = path.at(-2)
  if (tile === undefined) return undefined
  if (parent === undefined) {
    return { kind: 'root', title: tile.title, at: 'center', holds: holdsIn(tile) }
  }
  const seat = seatOf(parent, id)
  if (seat === undefined) return undefined
  const [ring, at] = seat
  const kind = ring === 'context' ? 'context' : tile.leaf === true ? 'leaf' : 'branch'
  return {
    kind,
    title: tile.title,
    at: center ? 'center' : at,
    parent: parent.title,
    holds: kind === 'branch' && holdsIn(tile),
  }
}

/** A Tile of the System as the chat names it: its title, and what its card says beside it. */
export function namedOf(system: TileNode, id: string) {
  const tile = pathTo(system, id).at(-1)
  const subject = subjectIn(system, id)
  if (tile === undefined || subject === undefined) return undefined
  return {
    title: tile.title,
    card: { place: placeOf(subject), ...(tile.preview !== '' && { description: tile.preview }) },
  }
}

/** A Tile the composer's `@` finds: its Title, and the Titles above it. */
interface Mentionable {
  id: string
  title: string
  path: string
}

/**
 * The Tiles of a System the composer's `@` finds on the page, as the feature's `mentionablesOf` reads
 * Mapping's (`features/conversation/composer/mention.ts`, which `ui/` cannot import): from the root
 * down, a generation after the other, each Direction's Branch, Context Tile and Leaf, with the Titles
 * above it. The fixture holds no Reference for it to skip, and no untitled Tile to name.
 */
export function mentionablesIn(system: TileNode): Mentionable[] {
  const all: Mentionable[] = []
  let generation: { tile: TileNode; trail: readonly string[] }[] = [{ tile: system, trail: [] }]
  while (generation.length > 0) {
    all.push(
      ...generation.map(({ tile, trail }) => ({
        id: tile.id,
        title: tile.title,
        path: trail.join(' / '),
      })),
    )
    generation = generation.flatMap(({ tile, trail }) =>
      directions.flatMap((direction) =>
        [tile.branches?.[direction], tile.context?.[direction], tile.leaves?.[direction]]
          .filter((below) => below !== undefined)
          .map((below) => ({ tile: below, trail: [...trail, tile.title] })),
      ),
    )
  }
  return all
}

/** What a Tile's menu says of it on the fixture canvas; none for a ring too full, which is no tile. */
const subjectOfHex = (hex: TileHex): Subject | undefined =>
  lookOf(hex).kind === 'list' ? undefined : subjectIn(ulysse, hex.tile.id, hex.role === 'center')

/** The System with the Tile of `id` changed, wherever it stands. */
function changed(system: TileNode, id: string, change: (tile: TileNode) => TileNode): TileNode {
  if (system.id === id) return change(system)
  const within = (ring: Partial<Record<Direction, TileNode>> | undefined) =>
    ring &&
    Object.fromEntries(
      Object.entries(ring).map(([direction, tile]) => [direction, changed(tile, id, change)]),
    )
  return {
    ...system,
    ...(system.branches && { branches: within(system.branches) }),
    ...(system.leaves && { leaves: within(system.leaves) }),
  }
}

/** Software Engineering with its rings changed. */
const inEngineering = (system: TileNode, change: (tile: TileNode) => TileNode) =>
  changed(system, engineering, change)

/** A tile written under Software Engineering: its kind, where it goes and its title. */
export interface Draft {
  kind: 'branch' | 'leaf' | 'context'
  place: Direction
  title: string
}

/**
 * Tooling, written under Software Engineering, in the ring of its kind, as the agent or the user
 * writes it: a Branch west, unless the tile widget says otherwise.
 */
const withTooling = (
  system: TileNode,
  { kind = 'branch', place = 6, title = tooling.title }: Partial<Draft> = {},
) =>
  inEngineering(system, (tile) => {
    const written: TileNode = { ...tooling, title, ...(kind === 'leaf' && { leaf: true }) }
    switch (kind) {
      case 'leaf':
        return { ...tile, leaves: { ...tile.leaves, [place]: written } }
      case 'context':
        return { ...tile, context: { ...tile.context, [place]: written } }
      case 'branch':
        return { ...tile, branches: { ...tile.branches, [place]: written } }
    }
  })

/** Tooling as the chat names it before it is there: its card says where it will stand. */
export const toolingNamed = namedOf(withTooling(ulysse), tooling.id) ?? { title: tooling.title }

/** Principles' preview, as the agent rewrites it. */
const principlesEdited = (system: TileNode) =>
  changed(system, 'principles', (tile) => ({ ...tile, preview: 'What I build on, in five words.' }))

/** A free slot of Software Engineering's at `at`: of its Context's ring, or else of its Children's. */
const isSlot = (slot: EmptySlotTarget, at: Direction, context = false) =>
  slot.parent.id === engineering && slot.direction === at && (slot.ring === 'context') === context

/** Marks by Tile, from a table; none for the others. */
const byTile =
  (marks: Record<string, TileMark | undefined>) =>
  (id: string): TileMark | undefined =>
    marks[id]

/** How far the agent's Turn has gone, as the canvas marks it. */
export interface TurnShown {
  /** Its light runs round Software Engineering, where it works, until it answers. */
  working: boolean
  /** The tile it reads now, glinting violet once. */
  reading?: string | undefined
  /** Tooling being written, breathing in its slot; then created, there. */
  writing: boolean
  created: boolean
  /** Principles' new preview, once edited. */
  edited: boolean
  /** The tile it changed just now, glinting once. */
  changed?: string | undefined
}

/**
 * The agent's Turn as the canvas shows it, as far as `shown` says it has gone (none before it runs),
 * as the chat's end tells it: each tile it reads glints violet once, while its light runs round
 * Software Engineering, where the Turn works; Tooling breathes in its slot while written, then is
 * there; what it changed glints, then keeps its dot until opened (`seen`); a Key editing Notes
 * meanwhile marks it hollow.
 */
export function turnOnCanvas(
  shown: TurnShown | undefined,
  seen: ReadonlySet<string>,
  keyed: boolean,
) {
  const system =
    shown?.edited === true
      ? principlesEdited(withTooling(ulysse))
      : shown?.created === true
        ? withTooling(ulysse)
        : ulysse
  const unseen = (id: string, done: boolean | undefined) => done === true && !seen.has(id)
  const marks: CanvasMarks = {
    tile: (id) => {
      const mark: TileMark = {
        ...(id === engineering && shown?.working === true && { working: true }),
        ...((id === shown?.reading || id === shown?.changed) && {
          glint: { by: 'agent', key: id },
        }),
        ...(((id === tooling.id && unseen(id, shown?.created)) ||
          (id === 'principles' && unseen(id, shown?.edited))) && { unseen: 'agent' }),
        ...(id === 'notes' && keyed && { glint: { by: 'key', key: 'key' } }),
        ...(id === 'notes' && keyed && !seen.has(id) && { unseen: 'key' }),
      }
      return Object.keys(mark).length === 0 ? undefined : mark
    },
    slot: (slot): Standing | undefined =>
      shown?.writing === true && isSlot(slot, 6)
        ? { id: tooling.id, look: { kind: 'draft', words: { title: tooling.title } } }
        : undefined,
  }
  return { system, marks }
}

/**
 * What the canvas draws of the agent's Proposal: what it would do, waiting on you; its changes
 * landed; or nothing of it, the System as it was, once it is discarded or undone. The chat decides
 * which.
 */
export type ProposalShown = 'waiting' | 'landed' | 'gone'

/**
 * The agent's Proposal on Software Engineering, as the canvas shows it: waiting, Tooling a ghost
 * west, Principles' rim dashed for its edit, Notes' for its move with an arc to the south-west, the
 * reading list stepped back for its deletion; landed, all of it there, your amber glinting on what
 * changed; gone, the System as it was.
 */
export function proposalOnCanvas(shown: ProposalShown) {
  if (shown === 'gone') return { system: ulysse, marks: {} satisfies CanvasMarks }
  if (shown === 'landed') {
    const system = inEngineering(principlesEdited(withTooling(ulysse)), (tile) => {
      const { leaves = {} } = tile
      // Notes, east, goes south-west, and the reading list, numbered 2, is gone.
      const notes = leaves[3]
      const kept = Object.entries(leaves).filter(([at]) => at !== '2' && at !== '3')
      return { ...tile, leaves: { ...Object.fromEntries(kept), ...(notes && { 5: notes }) } }
    })
    const landed = new Set(['tooling', 'principles', 'notes'])
    return {
      system,
      marks: {
        tile: (id: string): TileMark | undefined =>
          landed.has(id) ? { glint: { by: 'human', key: 'accepted' } } : undefined,
      } satisfies CanvasMarks,
    }
  }
  return {
    system: ulysse,
    marks: {
      tile: byTile({
        principles: { proposed: 'edit' },
        notes: { proposed: 'move' },
        'reading-list': { proposed: 'delete' },
      }),
      slot: (slot): Standing | undefined =>
        isSlot(slot, 6)
          ? { id: tooling.id, look: { kind: 'ghost', words: { title: tooling.title } } }
          : undefined,
      arcs: [{ from: 'notes', to: { parent: engineering, direction: 5 } }],
    } satisfies CanvasMarks,
  }
}

/**
 * A tile being written in the tile widget, as the canvas shows it: in its slot under Software
 * Engineering, in the ring of its kind, breathing in your amber, its title as typed; written, it is
 * there, a Branch, a Leaf or a Context Tile, glinting once.
 */
export function draftOnCanvas(draft: Draft, written: number) {
  const title = draft.title.trim() === '' ? m.tile_untitled() : draft.title
  if (written > 0) {
    return {
      system: withTooling(ulysse, { ...draft, title }),
      marks: {
        tile: byTile({ tooling: { glint: { by: 'human', key: written } } }),
      } satisfies CanvasMarks,
    }
  }
  return {
    system: ulysse,
    marks: {
      slot: (slot): Standing | undefined =>
        isSlot(slot, draft.place, draft.kind === 'context')
          ? { id: tooling.id, look: { kind: 'writing', words: { title } } }
          : undefined,
    } satisfies CanvasMarks,
  }
}

/**
 * The free places under Software Engineering a new tile may take, of any kind, as the canvas seats
 * its rings: free among its Children, and among its Context.
 */
export const freeInEngineering: readonly Direction[] = [5, 6]

/** A tile of the fixture, as the chat names it. */
interface Named {
  id: string
  title: string
}

/** A tile carried: which, and where the pointer is on the page, once off the frame. */
interface Carry extends Named {
  at: Point | undefined
}

/**
 * Software Engineering's frame, each tile carried off it under a mouse or a pen: it lifts and follows
 * the pointer, then, once off the frame, the page carries it, for the composer to name where it is let
 * go; let go anywhere, it settles back home. `onCarry` tells the tile carried, and nothing once let
 * go. A finger never carries a tile, whose way is the menu's or `@`.
 */
export function CarryFrame({ onCarry }: { onCarry: (tile: Named | undefined) => void }) {
  const svg = useRef<SVGSVGElement>(null)
  const scale = useScale(svg, { width: frameWidth, height: frameHeight })
  const units = unitsIn(svg)
  const { dragged, press } = useDrag(units)
  const [carry, setCarry] = useState<Carry>()
  const center: Hex = { center: { x: 0, y: 0 }, radius: frameRadius }
  const tiles: { id: string; hex: Hex; look: TileLook }[] = [
    {
      id: engineering,
      hex: center,
      look: { kind: 'branch', words: { title: 'Software Engineering' } },
    },
    ...directions.flatMap((direction) => {
      const member = ring[direction]
      return member === undefined
        ? []
        : [{ id: member.tile.id, hex: neighbor(center, direction), look: member.look }]
    }),
  ]
  return (
    <>
      <svg
        ref={svg}
        viewBox={`${String(-frameWidth / 2)} ${String(-frameHeight / 2)} ${String(frameWidth)} ${String(frameHeight)}`}
        className="w-[min(30rem,calc(100vw-3rem))] touch-pan-y select-none"
      >
        {directions
          .filter((direction) => ring[direction] === undefined)
          .map((direction) => (
            <Slot
              key={direction}
              hex={{ ...neighbor(center, direction), radius: frameRadius * gap }}
            />
          ))}
        {tiles.map(({ id, hex, look }) => {
          const carried = carry?.id === id
          const offset = carried && carry.at === undefined ? dragged?.offset : undefined
          return (
            <g
              key={id}
              className={carried && carry.at !== undefined ? 'opacity-40' : undefined}
              style={
                offset && { transform: `translate(${String(offset.x)}px, ${String(offset.y)}px)` }
              }
              onPointerDown={(event) => {
                const title = look.words.title
                press(event, {
                  onStart: () => {
                    setCarry({ id, title, at: undefined })
                    onCarry({ id, title })
                  },
                  onMove: (moved) => {
                    setCarry({ id, title, at: offFrame(svg.current, moved.at) })
                  },
                  onDrop: () => {
                    setCarry(undefined)
                    onCarry(undefined)
                  },
                })
              }}
            >
              <Lifted hex={hex} lifted={carried}>
                <Tile
                  hex={{ ...hex, radius: frameRadius * gap }}
                  {...look}
                  {...(id === engineering && { place: 'center' as const })}
                  scale={scale}
                />
              </Lifted>
            </g>
          )
        })}
      </svg>
      {carry?.at === undefined ? null : <Carried title={carry.title} at={carry.at} />}
    </>
  )
}

/**
 * Where the pointer is on the page, from where the drag is in the frame's units, once it has left the
 * frame; none while it is over it.
 */
function offFrame(svg: SVGSVGElement | null, at: Point): Point | undefined {
  const toPage = svg?.getScreenCTM()
  const box = svg?.getBoundingClientRect()
  if (toPage == null || box === undefined) return undefined
  const { x, y } = new DOMPoint(at.x, at.y).matrixTransform(toPage)
  const inside = x >= box.left && x <= box.right && y >= box.top && y <= box.bottom
  return inside ? undefined : { x, y }
}

/**
 * The menu of each tile and free slot on the fixture canvas, acting through the chat: the agent's
 * lines hand `onAsk` the tile to name first and, for a free slot, where the new tile would go; every
 * other line, which home runs in its widget at the conversation's foot, goes to `elsewhere` in its
 * own words. The lines that go somewhere are the canvas's.
 */
export function actingThroughChat({
  onAsk,
  elsewhere,
}: {
  onAsk: (tile: Named, where?: string) => void
  elsewhere: (said: string) => void
}): Pick<ComponentProps<typeof Canvas>, 'acting' | 'emptySlots'> {
  return {
    emptySlots: (slot) => ({
      label: m.tile_menu_add_at({
        direction: directionName(slot.direction),
        hub: slot.parent.title,
      }),
      onSelect: () => {
        elsewhere(m.tile_menu_add())
      },
    }),
    acting: {
      tile: (hex) => {
        const subject = subjectOfHex(hex)
        if (subject === undefined) return undefined
        return {
          subject,
          onAct: (act, said) => {
            if (act.verb === 'ask-agent') onAsk(hex.tile)
            else elsewhere(said)
          },
        }
      },
      slot: (slot) => ({
        subject: { kind: 'slot', at: slot.direction, parent: slot.parent.title },
        onAct: (act, said) => {
          if (act.verb === 'ask-agent') onAsk(slot.parent, directionName(slot.direction))
          else elsewhere(said)
        },
      }),
    },
  }
}
