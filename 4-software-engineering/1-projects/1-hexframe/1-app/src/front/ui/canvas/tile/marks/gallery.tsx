// Who touches a tile, on /design-system (HEX-108's proposal, ported from components.html's #marks):
// each mark on a tile of the fixture System at 1:1, held still, or played once it shows and again on
// its button, the agent telling of a tile's title, then its preview, among them (HEX-120); then a
// proposed move's arc on Software Engineering's frame. The crossings, the page's
// first section, show them live, answering the chat.
import type { ReactNode } from 'react'

import { m } from '#/paraglide/messages'

import { GalleryGroup, GallerySection, GalleryState } from '../../../gallery/frame'
import { toldUpTo } from '../../../motion'
import { directions, neighbor, type Hex } from '../../geometry/geometry'
import { Replayed, Specimen, type Play } from '../gallery'
import { Slot } from '../places'
import { tooling } from '../../fixtures'
import { branchOf, fixture, frameHeight, frameRadius, frameWidth, gap, ring } from '../specimens'
import { Tile, type TileLook } from '../Tile'
import { Arc } from './Marks'
import type { By, TileMark } from './mark'

const projects = branchOf(fixture('projects'))

/** A mark on a tile, held still, or played. */
interface MarkSample {
  name: () => string
  note: () => string
  draw: ((hex: Hex) => ReactNode) | Play
}

const marked =
  (mark: TileMark, look: TileLook = projects) =>
  (hex: Hex) => <Tile hex={hex} {...look} mark={mark} />

/** A glint, then, for a change you didn't make, the dot it leaves. */
const glinted = (by: By, leaves = false): Play => ({
  steps: leaves ? [0, 900] : [0],
  draw: (hex, step) => (
    <Tile
      hex={hex}
      {...projects}
      mark={{ glint: { by, key: 0 }, ...(step > 0 && by !== 'human' && { unseen: by }) }}
    />
  ),
})

const yours = (): readonly MarkSample[] => [
  {
    name: m.gallery_state_mark_pointed,
    note: m.gallery_mark_pointed,
    draw: marked({ pointed: 'tile' }),
  },
  { name: m.gallery_state_mark_way, note: m.gallery_mark_way, draw: marked({ pointed: 'way' }) },
  { name: m.gallery_state_mark_yours, note: m.gallery_mark_yours, draw: glinted('human') },
  {
    name: m.gallery_state_mark_writing,
    note: m.gallery_mark_writing,
    draw: (hex) => <Tile hex={hex} kind="writing" words={{ title: tooling.title }} />,
  },
]

/** The parts the agent tells of a tile's words, in turn, the sample's steps. */
const toldParts = toldUpTo('body')

/**
 * The agent telling of a tile's words, alone at the center as the tutorial's is: its title lit, then
 * its preview, then neither, as its body goes to the chat. Played on the gallery's clock, as every
 * played sample is; home's beats are `--stagger-beat` apart.
 */
const told: Play = {
  steps: [0, 1600, 3200],
  draw: (hex, step) => (
    <Tile hex={hex} {...projects} place="alone" mark={{ told: toldParts[step] }} />
  ),
}

const agents = (): readonly MarkSample[] => [
  { name: m.gallery_state_mark_reads, note: m.gallery_mark_reads, draw: glinted('agent') },
  { name: m.gallery_state_mark_told, note: m.gallery_mark_told, draw: told },
  {
    name: m.gallery_state_mark_working,
    note: m.gallery_mark_working,
    draw: marked({ working: true }),
  },
  {
    name: m.gallery_state_mark_drafting,
    note: m.gallery_mark_drafting,
    draw: (hex) => <Tile hex={hex} kind="draft" words={{ title: tooling.title }} />,
  },
  {
    name: m.gallery_state_mark_changed,
    note: m.gallery_mark_changed,
    draw: glinted('agent', true),
  },
  { name: m.gallery_state_mark_key, note: m.gallery_mark_key, draw: glinted('key', true) },
]

const proposals = (): readonly MarkSample[] => [
  {
    name: m.gallery_state_mark_ghost,
    note: m.gallery_mark_ghost,
    draw: (hex) => <Tile hex={hex} kind="ghost" words={{ title: tooling.title }} />,
  },
  {
    name: m.gallery_state_mark_edit,
    note: m.gallery_mark_edit,
    draw: marked({ proposed: 'edit' }),
  },
  {
    name: m.gallery_state_mark_delete,
    note: m.gallery_mark_delete,
    draw: marked({ proposed: 'delete' }),
  },
]

function Samples({ samples }: { samples: readonly MarkSample[] }) {
  return samples.map(({ name, note, draw }) =>
    typeof draw === 'function' ? (
      <Specimen key={name()} name={name()} note={note()} radius={76}>
        {draw}
      </Specimen>
    ) : (
      <Replayed key={name()} name={name()} note={note()} play={draw} />
    ),
  )
}

export function MarksGallery() {
  return (
    <GallerySection name="Marks">
      <GalleryGroup title={m.gallery_marks_yours()} note={m.gallery_marks_yours_note()} />
      <Samples samples={yours()} />
      <GalleryGroup title={m.gallery_marks_agent()} note={m.gallery_marks_agent_note()} />
      <Samples samples={agents()} />
      <GalleryGroup title={m.gallery_marks_proposed()} note={m.gallery_marks_proposed_note()} />
      <Samples samples={proposals()} />
      <GalleryState label={m.gallery_state_mark_move()}>
        <MovedFrame />
        <p className="max-w-[26rem] text-xs text-faint">{m.gallery_mark_move()}</p>
      </GalleryState>
    </GallerySection>
  )
}

/** Where Notes would go: the free slot south-west of Software Engineering. */
const landing = 5

/**
 * Software Engineering and its ring, Notes proposed to move south-west: its rim dashed violet, an arc
 * from it to the free slot it would land in.
 */
function MovedFrame() {
  const center: Hex = { center: { x: 0, y: 0 }, radius: frameRadius }
  const notesAt = neighbor(center, 3)
  const landingAt = neighbor(center, landing)
  return (
    <svg
      viewBox={`${String(-frameWidth / 2)} ${String(-frameHeight / 2)} ${String(frameWidth)} ${String(frameHeight)}`}
      role="img"
      aria-label={m.gallery_mark_move_label({
        center: fixture('software-engineering').title,
        tile: fixture('notes').title,
      })}
      className="w-[min(26rem,calc(100vw-3rem))]"
    >
      <Tile
        hex={{ ...center, radius: frameRadius * gap }}
        kind="branch"
        words={{ title: fixture('software-engineering').title }}
        place="center"
      />
      {directions.map((direction) => {
        const hex = { ...neighbor(center, direction), radius: frameRadius * gap }
        const member = ring[direction]
        if (member === undefined) return <Slot key={direction} hex={hex} />
        return (
          <Tile
            key={direction}
            hex={hex}
            {...member.look}
            {...(direction === 3 && { mark: { proposed: 'move' } })}
          />
        )
      })}
      <Arc
        from={notesAt.center}
        to={landingAt.center}
        radius={frameRadius}
        around={center.center}
      />
    </svg>
  )
}
