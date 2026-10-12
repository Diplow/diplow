// The chat's end of each crossing on /design-system (HEX-108): the composer, live on the demo's state,
// telling the Tile row it points at and taking what the canvas hands it; the agent naming tiles, each
// with its card; the agent's Turn as its events tell it, step by step; its Proposal, decided here; a
// tile written in the tile widget; and the entries navigations leave. Every tile named comes from the
// route, the canvas's own, with what a click and pointing at it do; the route joins each end to the
// canvas's (`ui/canvas/crossings.tsx`), since no folder of `ui/` imports both sides. The Tiles are
// the user's words, not translated; what is said of them is. What tells a time is drawn in the
// browser alone, since the time is the reader's.
import { ClientOnly } from '@tanstack/react-router'
import { Move, Pencil, RotateCcw, SquarePlus, Trash2 } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'

import { m } from '#/paraglide/messages'

import { Button } from '../atoms/controls/button'
import { Skeleton } from '../atoms/skeleton'
import { toast } from '../atoms/Toaster'
import { Composer } from './composer/Composer'
import type { useComposerDemo } from './composer/demo'
import { Events, type Folded, type Happened } from './entries/Events'
import { Proposal, type Fate } from './entries/Proposal'
import type { Change } from './entries/Receipt'
import type { MentionProps } from './text/Mention'
import { Message } from './text/Message'
import { weave } from './text/words'
import type { TileKind, TilePlace, TileWords } from './widgets/tile/parts'
import { TileWidget } from './widgets/tile/TileWidget'

/** A tile named, as the route hands it: its title, its card, what a click and pointing at it do. */
type Named = MentionProps

/** The Key that changes a tile meanwhile, by the name its user gave it: their words, not translated. */
const keyName = 'Claude Code, laptop'

/** In the browser alone, its times the reader's. */
function Browser({ children }: { children: ReactNode }) {
  return <ClientOnly fallback={<Skeleton className="h-64 w-full" />}>{children}</ClientOnly>
}

/** One more step of a specimen, under what it shows. */
function Again({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button size="xs" variant="ghost" className="self-start" onClick={onClick}>
      <RotateCcw aria-hidden />
      {label}
    </Button>
  )
}

type CrossingProps = Pick<
  ComponentProps<typeof Composer>,
  'onPoint' | 'place' | 'carried' | 'onDrop' | 'running'
>

/** The composer at the chat's foot, live on the demo's state: what is sent shows in a toast. */
export function ComposerEnd({
  demo,
  onSend,
  ...crossing
}: CrossingProps & { demo: ReturnType<typeof useComposerDemo>; onSend?: (text: string) => void }) {
  return (
    <Composer
      {...demo.composer}
      {...crossing}
      onSend={() => {
        const sent = demo.value.trim()
        if (onSend === undefined) toast(m.gallery_composer_sent({ message: sent }))
        else onSend(sent)
        demo.edit('', 0)
      }}
    />
  )
}

/** The agent naming three tiles: one on the canvas, one below it off the canvas, one beside them. */
export function NamingLine({ near, deep, beside }: { near: Named; deep: Named; beside: Named }) {
  return (
    <Message
      voice="agent"
      words={weave(m.crossing_pointing_answer, {
        near: { tile: near },
        deep: { tile: deep },
        beside: { tile: beside },
      })}
    />
  )
}

/** The tiles the agent's Turn touches, as the route hands them. */
interface TurnTiles {
  engineering: Named
  projects: Named
  principles: Named
  tooling: Named
  notes: Named
}

/** A line of the agent's, `running` while it is its step now. */
const agents = (words: Happened['words'], at: Date, tool: string, running = false): Happened => ({
  who: 'agent',
  words,
  tool,
  at,
  ...(running && { state: 'running' as const }),
})

/** What the agent's Turn has done by `step`, on its thread: its reads, folded once two, then its writes. */
function turnLines(step: number, tiles: TurnTiles, at: Date): (Happened | Folded)[] {
  const read = [tiles.engineering, tiles.projects, tiles.principles]
  const reads = read
    .slice(0, Math.max(step - 1, 0))
    .map((tile) => agents(weave(m.crossing_turn_read, { title: { tile } }), at, 'get_tile'))
  const reading = step >= 1 && step <= 3 ? read[step - 1] : undefined
  const line = (said: (inputs: Record<'title', string>) => string, tile: Named, tool: string) =>
    agents(weave(said, { title: { tile } }), at, tool)
  return [
    ...(reads.length < 2
      ? reads
      : [{ summary: m.crossing_turn_read_count({ count: reads.length }), events: reads }]),
    ...(reading === undefined
      ? []
      : [{ ...line(m.crossing_turn_reading, reading, 'get_tile'), state: 'running' as const }]),
    ...(step === 4
      ? [
          {
            ...line(m.crossing_turn_writing, tiles.tooling, 'create_tile'),
            state: 'running' as const,
          },
        ]
      : []),
    ...(step >= 5 ? [line(m.conversation_created_agent, tiles.tooling, 'create_tile')] : []),
    ...(step === 5
      ? [
          {
            ...line(m.crossing_turn_editing, tiles.principles, 'edit_tile'),
            state: 'running' as const,
          },
        ]
      : []),
    ...(step >= 6 ? [line(m.conversation_edited_agent, tiles.principles, 'edit_tile')] : []),
  ]
}

/**
 * The agent's Turn as the chat tells it, step by step, as the canvas's end marks it (`turnOnCanvas`):
 * asked, 1 to 3 it reads Software Engineering, Projects and Principles, the reads folding into one
 * line as they end; 4 it writes Tooling; 5 Tooling is created; 6 Principles edited; 7 it answers. A
 * Key's change, hollow, comes in on its own, named for the Key. Run it again, or let the Key change
 * Notes.
 */
export function TurnLines({
  step,
  tiles,
  keyed,
  at,
  onRun,
  onKey,
}: {
  step: number
  tiles: TurnTiles
  keyed: boolean
  at: Date
  onRun: () => void
  onKey: () => void
}) {
  const lines = turnLines(step, tiles, at)
  const key: Happened = {
    who: 'key',
    words: weave(m.conversation_edited_by, {
      actor: { name: keyName },
      title: { tile: tiles.notes },
    }),
    tool: 'edit_tile',
    at,
  }
  return (
    <Browser>
      {step === 0 ? null : (
        <Message
          voice="human"
          words={weave(m.crossing_turn_ask, {
            engineering: { tile: tiles.engineering },
            principles: { tile: tiles.principles },
          })}
        />
      )}
      {lines.length === 0 ? null : <Events lines={lines} />}
      {step >= 7 ? (
        <Message
          voice="agent"
          words={weave(m.crossing_turn_answer, {
            tooling: { tile: tiles.tooling },
            principles: { tile: tiles.principles },
          })}
        />
      ) : null}
      {keyed ? <Events lines={[key]} /> : null}
      <div className="flex flex-wrap gap-2">
        <Again label={m.crossing_run_turn()} onClick={onRun} />
        <Button size="xs" variant="ghost" onClick={onKey}>
          {m.crossing_key_edits({ title: tiles.notes.title })}
        </Button>
      </div>
    </Browser>
  )
}

/** The tiles the agent's Proposal changes, and the one it tidies, as the route hands them. */
interface ProposalTiles {
  tidied: string
  tooling: Named
  principles: Named
  notes: Named
  reading: Named
}

/**
 * The agent's Proposal on Software Engineering, open in the chat while the canvas shows its ghosts:
 * Tooling created, Principles edited, Notes moved, the reading list deleted. Each change names its
 * tile, which the canvas lights as it is pointed at; decided, it leaves its receipt, with its Undo,
 * and the specimen proposes again.
 */
export function ProposalEnd({
  tiles,
  onAgain,
  ...decision
}: {
  tiles: ProposalTiles
  fate: Fate
  undone: boolean
  at: Date
  onAccept: () => void
  onDiscard: () => void
  onUndo: () => void
  onAgain: () => void
}) {
  const changes: Change[] = [
    {
      icon: SquarePlus,
      words: weave(m.conversation_proposal_create, { title: { tile: tiles.tooling } }),
    },
    {
      icon: Pencil,
      words: weave(m.conversation_proposal_edit, { title: { tile: tiles.principles } }),
    },
    { icon: Move, words: weave(m.conversation_proposal_move, { title: { tile: tiles.notes } }) },
    {
      icon: Trash2,
      words: weave(m.conversation_proposal_delete, { title: { tile: tiles.reading } }),
    },
  ]
  return (
    <Browser>
      <Proposal
        title={m.crossing_proposal_title({ title: tiles.tidied })}
        summary={m.crossing_proposal_summary()}
        changes={changes}
        {...decision}
      />
      {decision.fate === 'open' ? null : (
        <Again label={m.crossing_propose_again()} onClick={onAgain} />
      )}
    </Browser>
  )
}

/** A tile being written, as the route holds it: its words, its kind, its place, and once written. */
interface Drafted {
  words: TileWords
  onWordsChange: (words: TileWords) => void
  where: TilePlace
  onPlaceChange: (place: TilePlace['place']) => void
  onKindChange: (kind: TileKind) => void
  /** Mapping's limit on a Preview, which the route reads at its door. */
  previewLimit: number
  /** When it was written; none while it is being written. */
  written: Date | undefined
  onCreate: () => void
  onAgain: () => void
}

/**
 * A tile written in the tile widget, in your amber, its place picked on the widget's map, while the
 * canvas shows it breathing in its slot; created, its receipt, with its Undo, and another to write.
 */
export function DraftingEnd({ written, onAgain, ...draft }: Drafted) {
  const title = draft.words.title.trim() === '' ? m.tile_untitled() : draft.words.title
  return (
    <Browser>
      {written === undefined ? (
        <TileWidget mode="new" {...draft} onCancel={onAgain} />
      ) : (
        <>
          <TileWidget
            mode="done"
            did="created"
            tile={{ title }}
            where={draft.where}
            at={written}
            onUndo={onAgain}
          />
          <Again label={m.crossing_write_again()} onClick={onAgain} />
        </>
      )}
    </Browser>
  )
}

/**
 * The entries navigations leave in the chat, each told as the timeline tells it, the route reading it
 * through home's own words, and a Message between them, which ends the navigation under way.
 */
export function NavigationLines({
  lines,
  onSay,
}: {
  lines: readonly (Happened | 'said')[]
  onSay: () => void
}) {
  return (
    <Browser>
      {lines.map((line, index) =>
        // The specimen's entries, never reordered: their place is their key.
        line === 'said' ? (
          <Message key={index} voice="human" words={[m.crossing_navigation_said()]} />
        ) : (
          <Events key={index} lines={[line]} />
        ),
      )}
      <Button size="xs" variant="ghost" className="self-start" onClick={onSay}>
        {m.crossing_say_something()}
      </Button>
    </Browser>
  )
}
