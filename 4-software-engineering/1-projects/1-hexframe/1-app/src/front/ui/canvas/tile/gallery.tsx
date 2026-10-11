// The tile on /design-system, on the fixture System: what it can be, how it answers your hand, its
// place and time, a frame whose Branches open in place, and its words from far to near; then the
// places it stands in, and the ground of a hex opened. Ported from components.html's #kinds, #states
// and #words.
import { RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { m } from '#/paraglide/messages'

import { Button } from '../../atoms/controls/button'
import { GallerySection, GalleryState } from '../../gallery/frame'
import { ulysse } from '../fixtures'
import { directions, neighbor, type Hex } from '../geometry/geometry'
import { fitWords } from '../geometry/words'
import { Slot } from './places'
import { branchOf, fixture, LiveFrame, OpenedSpecimen, useScale, wordsOf } from './specimens'
import { Tile, type TileLook } from './Tile'

const origin = { x: 0, y: 0 }

export function TileGallery() {
  return (
    <>
      <GallerySection name="Tile">
        <Group title={m.gallery_tile_kinds()} note={m.gallery_tile_kinds_note()} />
        <TileKinds />
        <Group title={m.gallery_tile_states()} note={m.gallery_tile_states_note()} />
        <TileStates />
        <Group title={m.gallery_tile_frame()} note={m.gallery_tile_frame_note()} />
        <GalleryState label={m.gallery_state_tile_frame()}>
          <LiveFrame />
        </GalleryState>
        <Group title={m.gallery_tile_words()} note={m.gallery_tile_words_note()} />
        <TileWordsSpecimen />
      </GallerySection>
      <GallerySection name="Slot">
        <Specimen name={m.gallery_state_slot_free()} note={m.gallery_tile_slot_free()} radius={76}>
          {(hex) => (
            <Slot hex={hex} action={{ label: m.gallery_sample_add_tile(), onSelect: noop }} />
          )}
        </Specimen>
        <Specimen name={m.gallery_state_slot_void()} note={m.gallery_tile_slot_void()} radius={76}>
          {(hex) => <Slot hex={hex} />}
        </Specimen>
        <Specimen name={m.gallery_state_loading()} note={m.gallery_tile_loading()} radius={76}>
          {(hex) => <Slot hex={hex} loading />}
        </Specimen>
      </GallerySection>
      <GallerySection name="Ground">
        <GalleryState label={m.gallery_state_ground_opened()}>
          <OpenedSpecimen tile={fixture('projects')} />
        </GalleryState>
        <GalleryState label={m.gallery_state_ground_context()}>
          <OpenedSpecimen tile={fixture('software-engineering')} context />
        </GalleryState>
      </GallerySection>
    </>
  )
}

function noop() {
  // A specimen's click: what it does is the caller's, on the canvas.
}

/** A row's heading inside a piece's section, the full width, and what the row shows. */
function Group({ title, note }: { title: string; note: string }) {
  return (
    <div className="grid basis-full gap-1 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <h4 className="font-mono text-xs text-faint">{title}</h4>
      <p className="max-w-prose text-sm text-muted-foreground">{note}</p>
    </div>
  )
}

/** One tile at the center of its own drawing, at 1:1, with what it shows in a line under it. */
function Specimen({
  name,
  note,
  radius,
  children,
  after,
}: {
  name: string
  note: string
  radius: number
  children: (hex: Hex) => ReactNode
  /** Under the drawing, before its line: a specimen's own control. */
  after?: ReactNode
}) {
  const width = Math.ceil(Math.sqrt(3) * radius) + 24
  const height = Math.ceil(radius * 2) + 12
  return (
    <GalleryState label={name}>
      <svg
        width={width}
        height={height}
        viewBox={`${String(-width / 2)} ${String(-height / 2)} ${String(width)} ${String(height)}`}
        className="overflow-visible"
      >
        {children({ center: origin, radius })}
      </svg>
      {after}
      <p className="text-xs text-faint" style={{ width }}>
        {note}
      </p>
    </GalleryState>
  )
}

interface KindSample {
  name: () => string
  note: () => string
  tile: TileLook
}

const kindSamples: readonly KindSample[] = [
  {
    name: m.gallery_state_tile_root,
    note: m.gallery_tile_root,
    tile: { kind: 'root', words: wordsOf(ulysse), foot: directions },
  },
  {
    name: m.gallery_state_tile_branch,
    note: m.gallery_tile_branch,
    tile: branchOf(fixture('projects')),
  },
  {
    name: m.gallery_state_tile_bare_branch,
    note: m.gallery_tile_bare_branch,
    tile: branchOf(fixture('principles')),
  },
  {
    name: m.gallery_state_tile_leaf,
    note: m.gallery_tile_leaf,
    tile: { kind: 'leaf', words: wordsOf(fixture('notes')) },
  },
  {
    name: m.gallery_state_tile_file,
    note: m.gallery_tile_file,
    tile: { kind: 'leaf', words: wordsOf(fixture('diplow-hexframe')), file: true },
  },
  {
    name: m.gallery_state_tile_context,
    note: m.gallery_tile_context,
    tile: { kind: 'context', words: wordsOf(fixture('ai-first')) },
  },
  {
    name: m.gallery_state_tile_reference,
    note: m.gallery_tile_reference,
    tile: {
      kind: 'reference',
      words: wordsOf(fixture('principles')),
      from: 'Software Engineering',
    },
  },
  {
    name: m.gallery_state_tile_broken,
    note: m.gallery_tile_broken,
    tile: { kind: 'broken', words: { title: m.tile_broken_title() } },
  },
  {
    name: m.gallery_state_tile_untitled,
    note: m.gallery_tile_untitled,
    tile: {
      kind: 'untitled',
      words: { title: m.tile_untitled(), preview: m.tile_untitled_preview() },
    },
  },
  {
    name: m.gallery_state_tile_clash,
    note: m.gallery_tile_clash,
    tile: {
      kind: 'leaf',
      words: wordsOf(fixture('reading-list')),
      clash: 'Principles',
    },
  },
  {
    name: m.gallery_state_tile_list,
    note: m.gallery_tile_list,
    tile: {
      kind: 'list',
      words: { title: m.tile_list_title({ count: 8 }) },
      names: ['Leadership', 'Education', 'Games', m.tile_list_more({ count: 5 })],
    },
  },
  {
    name: m.gallery_state_tile_draft,
    note: m.gallery_tile_draft,
    tile: { kind: 'draft', words: wordsOf(fixture('obsidian')) },
  },
]

function TileKinds() {
  return kindSamples.map(({ name, note, tile }) => (
    <Specimen key={name()} name={name()} note={note()} radius={88}>
      {(hex) => <Tile hex={hex} {...tile} />}
    </Specimen>
  ))
}

const projects = fixture('projects')
const projectsTile = branchOf(projects)

/** A tile you can try: hover it, focus it, press it; its click is the canvas's. */
const tried = { label: m.gallery_sample_try_tile({ title: projects.title }), onSelect: noop }

/** A state on its own drawing, held still, or played once it shows and again on its button. */
interface StateSample {
  name: () => string
  note: () => string
  draw: ((hex: Hex) => ReactNode) | Play
}

const center = fixture('software-engineering')

const stateSamples = (): readonly StateSample[] => [
  {
    name: m.gallery_state_tile_rest,
    note: m.gallery_tile_rest,
    draw: (hex) => <Tile hex={hex} {...projectsTile} action={tried} />,
  },
  ...(['pointed', 'focused', 'pressed'] as const).map((held) => ({
    name: heldNames[held][0],
    note: heldNames[held][1],
    draw: (hex: Hex) => <Tile hex={hex} {...projectsTile} held={held} />,
  })),
  {
    name: m.gallery_state_tile_center,
    note: m.gallery_tile_center,
    draw: (hex) => <Tile hex={hex} kind="branch" words={wordsOf(center)} place="center" />,
  },
  {
    name: m.gallery_state_tile_root_center,
    note: m.gallery_tile_root_center,
    draw: (hex) => <Tile hex={hex} kind="root" words={wordsOf(ulysse)} place="center" />,
  },
  {
    name: m.gallery_state_tile_leaf_center,
    note: m.gallery_tile_leaf_center,
    draw: (hex) => <Tile hex={hex} kind="leaf" words={wordsOf(fixture('notes'))} place="center" />,
  },
  {
    name: m.gallery_state_tile_near,
    note: m.gallery_tile_near,
    draw: (hex) => <Tile hex={hex} {...projectsTile} place="near" />,
  },
  {
    name: m.gallery_state_tile_far,
    note: m.gallery_tile_far,
    draw: (hex) => <Tile hex={hex} {...projectsTile} place="far" />,
  },
  { name: m.gallery_state_tile_bloom, note: m.gallery_tile_bloom, draw: blooming },
  { name: m.gallery_state_tile_fold, note: m.gallery_tile_fold, draw: folding },
  {
    name: m.gallery_state_tile_pending,
    note: m.gallery_tile_pending,
    draw: (hex) => <Tile hex={hex} {...projectsTile} write="pending" />,
  },
  { name: m.gallery_state_tile_refused, note: m.gallery_tile_refused, draw: refused },
]

const heldNames = {
  pointed: [m.gallery_state_tile_pointed, m.gallery_tile_pointed],
  focused: [m.gallery_state_tile_focused, m.gallery_tile_focused],
  pressed: [m.gallery_state_tile_pressed, m.gallery_tile_pressed],
} as const

function TileStates() {
  return stateSamples().map(({ name, note, draw }) =>
    typeof draw === 'function' ? (
      <Specimen key={name()} name={name()} note={note()} radius={76}>
        {draw}
      </Specimen>
    ) : (
      <Replayed key={name()} name={name()} note={note()} play={draw} />
    ),
  )
}

/** A specimen that plays: when each of its steps comes, in ms from its start, and what each draws. */
interface Play {
  steps: readonly number[]
  draw: (hex: Hex, step: number) => ReactNode
}

/** From a tile in the north-west of its ring, its parent's heart is south-east of it. */
const heartOf = (hex: Hex) => neighbor(hex, 4).center

/** Out of its parent's heart, once it shows. */
const blooming: Play = {
  steps: [0],
  draw: (hex) => <Tile hex={hex} {...projectsTile} motion={{ way: 'bloom', from: heartOf(hex) }} />,
}

/** Back into its parent's heart, then out again, so it ends where it started. */
const folding: Play = {
  steps: [0, 1500],
  draw: (hex, step) => (
    <Tile
      hex={hex}
      {...projectsTile}
      motion={{ way: step === 0 ? 'fold' : 'bloom', from: heartOf(hex) }}
    />
  ),
}

/** Written into a free slot, on its way, refused: it flares, then goes back, the slot left free. */
const refused: Play = {
  steps: [0, 1300, 2600, 3200],
  draw: (hex, step) => (
    <>
      <Slot hex={hex} />
      {step < 3 ? (
        <Tile
          hex={hex}
          {...projectsTile}
          write={step === 0 ? 'pending' : 'refused'}
          motion={{ way: step < 2 ? 'bloom' : 'fold', from: hex.center }}
        />
      ) : null}
    </>
  ),
}

/** A specimen that plays once it shows, and again on its button. */
function Replayed({ name, note, play }: { name: string; note: string; play: Play }) {
  const [turn, setTurn] = useState(0)
  const step = useSteps(play.steps, turn)
  return (
    <Specimen
      name={name}
      note={note}
      radius={76}
      after={
        <Button
          size="xs"
          variant="ghost"
          className="justify-self-start"
          onClick={() => {
            setTurn((previous) => previous + 1)
          }}
        >
          <RotateCcw aria-hidden />
          {m.gallery_replay()}
        </Button>
      }
    >
      {(hex) => <g key={turn}>{play.draw(hex, step)}</g>}
    </Specimen>
  )
}

/** The step reached in a play, each `steps[i]` ms after it started, started again at every turn. */
function useSteps(steps: readonly number[], turn: number): number {
  const [step, setStep] = useState(0)
  useEffect(() => {
    setStep(0)
    const timers = steps.slice(1).map((at, index) =>
      setTimeout(() => {
        setStep(index + 1)
      }, at),
    )
    return () => {
      timers.forEach(clearTimeout)
    }
  }, [steps, turn])
  return step
}

type Preset = 'short' | 'longTitle' | 'longPreview' | 'noPreview' | 'file' | 'draft'

const presets: Record<Preset, () => TileLook> = {
  short: () => ({ kind: 'branch', words: wordsOf(projects) }),
  longTitle: () => ({
    kind: 'branch',
    words: { title: m.gallery_sample_long_title(), preview: m.gallery_sample_long_title_preview() },
  }),
  longPreview: () => ({ kind: 'branch', words: wordsOf(fixture('hexframe')) }),
  noPreview: () => ({ kind: 'branch', words: { title: fixture('principles').title } }),
  file: () => ({ kind: 'leaf', words: wordsOf(fixture('diplow-hexframe')), file: true }),
  draft: () => ({
    kind: 'draft',
    words: wordsOf(fixture('obsidian')),
  }),
}

const presetNames: Record<Preset, () => string> = {
  short: m.gallery_tile_words_short,
  longTitle: m.gallery_tile_words_long_title,
  longPreview: m.gallery_tile_words_long_preview,
  noPreview: m.gallery_tile_words_no_preview,
  file: m.gallery_tile_words_file,
  draft: m.gallery_tile_words_draft,
}

const stripRadii = [28, 50, 90, 130, 180] as const

/** What a tile of this radius on screen shows of its words. */
function shown(radius: number): string {
  const fit = fitWords(radius)
  if (fit === undefined) return m.gallery_tile_words_none()
  if (fit.preview === undefined) return m.gallery_tile_words_alone()
  return fit.capped ? m.gallery_tile_words_capped() : m.gallery_tile_words_both()
}

/** The sizes its words take at this radius on screen. */
function readout(radius: number): string {
  const fit = fitWords(radius)
  if (fit === undefined) return m.gallery_tile_words_read_none({ radius })
  const title = fit.title.toFixed(1)
  return fit.preview === undefined
    ? m.gallery_tile_words_read_alone({ radius, title })
    : m.gallery_tile_words_read({ radius, title, preview: fit.preview.toFixed(1) })
}

/** The words at any size: a preset, a slider for the tile's size on screen, and from far to near. */
function TileWordsSpecimen() {
  const [preset, setPreset] = useState<Preset>('short')
  const [radius, setRadius] = useState(112)
  const svg = useRef<SVGSVGElement>(null)
  const box = Math.ceil(Math.sqrt(3) * 200) + 8
  // CSS narrows the drawing on a phone: the tile is fitted to the size it shows at, as said below.
  const scale = useScale(svg, box)
  const tile = presets[preset]()
  return (
    <>
      <GalleryState label={m.gallery_state_tile_words()}>
        <div role="group" aria-label={m.gallery_tile_words()} className="flex flex-wrap gap-1">
          {(Object.keys(presets) as Preset[]).map((key) => (
            <Button
              key={key}
              size="xs"
              variant={key === preset ? 'secondary' : 'ghost'}
              aria-pressed={key === preset}
              onClick={() => {
                setPreset(key)
              }}
            >
              {presetNames[key]()}
            </Button>
          ))}
        </div>
        <svg
          ref={svg}
          width={box}
          height={408}
          viewBox={`${String(-box / 2)} -204 ${String(box)} 408`}
          className="h-auto max-w-full"
        >
          <Tile hex={{ center: origin, radius }} {...tile} scale={scale} />
        </svg>
        <label className="grid max-w-96 gap-1 text-xs text-muted-foreground">
          {m.gallery_tile_words_size()}
          <input
            type="range"
            min={24}
            max={200}
            value={radius}
            onChange={(event) => {
              setRadius(Number(event.target.value))
            }}
            className="accent-human pointer-coarse:h-11"
          />
          <output className="font-mono text-faint">{readout(Math.round(radius * scale))}</output>
        </label>
      </GalleryState>
      <GalleryState label={m.gallery_state_tile_strip()}>
        <div className="overflow-x-auto">
          <div className="flex items-end gap-6">
            {stripRadii.map((size) => {
              const width = Math.ceil(Math.sqrt(3) * size) + 4
              return (
                <figure key={size} className="grid justify-items-center gap-2">
                  <svg
                    width={width}
                    height={2 * size + 4}
                    viewBox={`${String(-width / 2)} ${String(-size - 2)} ${String(width)} ${String(2 * size + 4)}`}
                  >
                    <Tile hex={{ center: origin, radius: size }} {...tile} />
                  </svg>
                  <figcaption className="text-center font-mono text-xs text-faint">
                    {m.gallery_tile_words_at({ radius: size })}
                    <br />
                    {shown(size)}
                  </figcaption>
                </figure>
              )
            })}
          </div>
        </div>
      </GalleryState>
    </>
  )
}
