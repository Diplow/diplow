// Acting on a tile on /design-system, on the fixture System: a frame whose tiles and free slots each
// open their menu, by a right click, a long press or ⇧F10, show their card on hover or focus, and
// take their keys; what a line or a click would do shows in a toast. Then each kind's menu, held
// open. Ported from components.html's #menu.
import { useRef } from 'react'

import { m } from '#/paraglide/messages'

import { toast } from '../../../atoms/Toaster'
import { GalleryGroup, GallerySection, GalleryState } from '../../../gallery/frame'
import { ulysse } from '../../fixtures'
import { directions, neighbor, type Hex } from '../../geometry/geometry'
import { useScale } from '../../state/useScale'
import type { TileNode } from '../../view/tiles'
import { Slot } from '../places'
import {
  fixture,
  frameHeight,
  frameRadius,
  frameWidth,
  gap,
  ring,
  seatsOf,
  trades,
  wordsOf,
} from '../specimens'
import { Tile, type TileLook } from '../Tile'
import type { PickerFrame } from './Picker'
import { TileMenu, TileMenuDrawn, useFinger, verbName } from './TileMenu'
import { clickOf, directionName, type TileAct, type Subject } from './verbs'

export function TileMenuGallery() {
  return (
    <GallerySection name="TileMenu">
      <GalleryGroup title={m.gallery_tile_menu_live()} note={m.gallery_tile_menu_live_note()} />
      <GalleryState label={m.gallery_state_tile_menu_live()}>
        <ActingFrame />
      </GalleryState>
      <GalleryGroup title={m.gallery_tile_menu_kinds()} note={m.gallery_tile_menu_kinds_note()} />
      {drawnSamples().map(({ name, subject, frames }) => (
        <GalleryState key={name} label={name}>
          <TileMenuDrawn subject={subject} frames={frames} />
        </GalleryState>
      ))}
      <GalleryGroup title={m.gallery_tile_menu_finger()} note={m.gallery_tile_menu_finger_note()} />
    </GallerySection>
  )
}

const center = fixture('software-engineering')

/** How many tiles are below a tile, all the way down. */
function countBelow(tile: TileNode): number {
  return [...Object.values(tile.branches ?? {}), ...Object.values(tile.leaves ?? {})].reduce(
    (count, child) => count + 1 + countBelow(child),
    0,
  )
}

/**
 * Whether a tile of the fixture System can turn into the other kind: a Branch holding nothing, a
 * Leaf. On home, Mapping's `decide` says so, a Direction taken included.
 */
const turnsOf = (tile: TileNode) => tile.leaf === true || countBelow(tile) === 0

/** Whether a tile of the fixture System takes a new tile: a Branch does. On home, `decide` says. */
const holdsOf = (tile: TileNode) => tile.leaf !== true

/** A tile's children as a picker draws them: a Branch trades places, a Leaf doesn't. */
function frameOf(tile: TileNode): PickerFrame {
  const seats: PickerFrame['seats'] = {}
  for (const direction of directions) {
    const child = tile.branches?.[direction] ?? tile.leaves?.[direction]
    if (child !== undefined) seats[direction] = { title: child.title, swaps: trades(child) }
  }
  return { hub: tile.title, seats }
}

/** Software Engineering's ring as a picker draws it, the reading list beside Principles. */
const centerFrame: PickerFrame = { hub: center.title, seats: seatsOf(ring) }

/** What would happen, in a toast: the page acts on nothing. */
const shown = (subject: Subject) => (_act: TileAct, what: string) => {
  const title = subject.kind === 'slot' ? m.tile_menu_free_slot() : subject.title
  toast(m.gallery_tile_menu_did({ title, what }))
}

/**
 * Software Engineering and its ring, each tile in its menu and its card, each free slot in its menu:
 * try a right click, a long press, ⇧F10, a key on a focused tile, a click or, under a finger, a tap.
 */
function ActingFrame() {
  const svg = useRef<SVGSVGElement>(null)
  const scale = useScale(svg, { width: frameWidth, height: frameHeight })
  const finger = useFinger()
  const centerHex = { center: { x: 0, y: 0 }, radius: frameRadius }
  const centerSubject: Subject = {
    kind: 'branch',
    title: center.title,
    at: 'center',
    parent: ulysse.title,
    holds: true,
  }
  return (
    <svg
      ref={svg}
      viewBox={`${String(-frameWidth / 2)} ${String(-frameHeight / 2)} ${String(frameWidth)} ${String(frameHeight)}`}
      role="group"
      aria-label={m.hex_canvas_label({ title: center.title })}
      className="w-[min(37.5rem,calc(100vw-3rem))]"
    >
      <Acting
        subject={centerSubject}
        look={{ kind: 'branch', words: wordsOf(center) }}
        tile={center}
        frames={{ holds: centerFrame }}
        hex={{ ...centerHex, radius: frameRadius * gap }}
        place="center"
        scale={scale}
        finger={finger}
      />
      {directions.map((direction) => {
        const hex = { ...neighbor(centerHex, direction), radius: frameRadius * gap }
        const seated = ring[direction]
        if (seated === undefined) {
          const subject: Subject = { kind: 'slot', at: direction, parent: center.title }
          const act = shown(subject)
          return (
            <TileMenu key={direction} subject={subject} onAct={act}>
              {(hand) => (
                <Slot
                  hex={hex}
                  hand={hand}
                  action={{
                    label: m.tile_menu_add_at({
                      direction: directionName(direction),
                      hub: center.title,
                    }),
                    onSelect: () => {
                      act({ verb: 'new-tile' }, verbName('new-tile', subject))
                    },
                  }}
                />
              )}
            </TileMenu>
          )
        }
        const { tile, look } = seated
        // Software Engineering's ring holds Branches and Leaves alone.
        if (look.kind !== 'branch' && look.kind !== 'leaf') return null
        return (
          <Acting
            key={tile.id}
            subject={{
              kind: look.kind,
              title: tile.title,
              at: direction,
              parent: center.title,
              below: countBelow(tile),
              turns: turnsOf(tile),
              holds: holdsOf(tile),
            }}
            look={look}
            tile={tile}
            frames={{ holds: frameOf(tile), standsIn: centerFrame }}
            hex={hex}
            scale={scale}
            finger={finger}
          />
        )
      })}
    </svg>
  )
}

interface ActingProps {
  subject: Subject
  look: TileLook
  tile: TileNode
  frames: { holds?: PickerFrame; standsIn?: PickerFrame }
  hex: Hex
  place?: 'center'
  scale: number
  finger: boolean
}

/** A tile of the frame in its menu and its card, its click or tap told in a toast. */
function Acting({ subject, look, tile, frames, hex, place, scale, finger }: ActingProps) {
  const act = shown(subject)
  const click = clickOf(subject, finger)
  const clash = look.kind === 'leaf' ? look.clash : undefined
  return (
    <TileMenu
      subject={subject}
      card={{
        description: tile.preview,
        ...(clash !== undefined && {
          note: { text: m.tile_clash({ branch: clash }), tone: 'warning' as const },
        }),
      }}
      frames={frames}
      onAct={act}
    >
      {(hand) => (
        <Tile
          hex={hex}
          {...look}
          {...(place !== undefined && { place })}
          scale={scale}
          hand={hand}
          {...(click !== undefined && {
            action: {
              label: m.gallery_tile_menu_click({
                what: verbName(click, subject),
                title: tile.title,
              }),
              onSelect: () => {
                act({ verb: click }, verbName(click, subject))
              },
            },
          })}
        />
      )}
    </TileMenu>
  )
}

interface DrawnSample {
  name: string
  subject: Subject
  frames?: { holds?: PickerFrame; standsIn?: PickerFrame }
}

/** Each kind's menu, where it stands: read at render, in the page's language. */
function drawnSamples(): DrawnSample[] {
  const projects = fixture('projects')
  const inRing = { parent: center.title }
  return [
    {
      name: m.gallery_state_tile_menu_branch(),
      subject: {
        kind: 'branch',
        title: projects.title,
        at: 1,
        below: countBelow(projects),
        turns: turnsOf(projects),
        holds: true,
        ...inRing,
      },
      frames: { holds: frameOf(projects), standsIn: centerFrame },
    },
    {
      name: m.gallery_state_tile_menu_leaf(),
      subject: { kind: 'leaf', title: fixture('notes').title, at: 3, turns: true, ...inRing },
      frames: { standsIn: centerFrame },
    },
    {
      name: m.gallery_state_tile_menu_context(),
      subject: { kind: 'context', title: fixture('ai-first').title, at: 2, ...inRing },
      frames: { standsIn: centerFrame },
    },
    {
      name: m.gallery_state_tile_menu_reference(),
      subject: { kind: 'reference', title: fixture('principles').title, at: 5, ...inRing },
    },
    {
      name: m.gallery_state_tile_menu_broken(),
      subject: { kind: 'broken', title: m.tile_broken_title(), at: 6, ...inRing },
    },
    {
      name: m.gallery_state_tile_menu_draft(),
      subject: { kind: 'draft', title: fixture('obsidian').title, at: 4, ...inRing },
    },
    {
      name: m.gallery_state_tile_menu_center(),
      subject: {
        kind: 'branch',
        title: center.title,
        at: 'center',
        parent: ulysse.title,
        holds: true,
      },
      frames: { holds: centerFrame },
    },
    {
      name: m.gallery_state_tile_menu_root(),
      subject: { kind: 'root', title: ulysse.title, at: 'center', holds: true },
      frames: { holds: frameOf(ulysse) },
    },
    {
      name: m.gallery_state_tile_menu_untitled(),
      subject: { kind: 'untitled', title: m.tile_untitled(), at: 'center', holds: true },
      frames: { holds: { hub: m.tile_untitled(), seats: {} } },
    },
    {
      name: m.gallery_state_tile_menu_slot(),
      subject: { kind: 'slot', at: 5, parent: center.title },
    },
  ]
}
