// The Conversation in two parts, on the chat's pieces (ui's `chat/`): its timeline a day at a time,
// newest at the bottom, each day under its split, what the user and the agent said in their voices,
// what happened between them on its thread, a Proposal decided where it stands and what was applied
// undone, a quiet action above the oldest day shown reading the day before; after the last Entry the
// user's Messages still on their way, or refused with a retry, and the agent's step while a Turn runs.
// And its foot, the composer: the user writes to the agent, `@`s their Tiles, opens a command with a
// `/`, the language among them, and sees the Mode under the field, or that the Account may not use the
// Assistant; while a Turn runs the field waits and send becomes Stop. Home's screen takes the two apart,
// the timeline beside the curve and the foot at the chat's foot; `Conversation` lays them out
// together, for /design-system.
import { cn } from 'cn'
import { MessagesSquare } from 'lucide-react'
import { useRef } from 'react'

import type { Mode, TurnStep } from '#/domains/assistant/entities'
import { m } from '#/paraglide/messages'
import { assertIsLocale, getLocale, localizeHref } from '#/paraglide/runtime'
import { Act } from '#/front/ui/atoms/controls/act'
import { languageNamed } from '#/front/ui/chat/composer/commands'
import { Composer } from '#/front/ui/chat/composer/Composer'
import { DaySplit } from '#/front/ui/chat/entries/DaySplit'
import { Events, type Happened } from '#/front/ui/chat/entries/Events'
import { Message } from '#/front/ui/chat/text/Message'
import { EmptyState } from '#/front/ui/layouts/states'

import type { Mentionable } from './composer/mention'
import { type Offering, offered, type RunCommand } from './composer/typing'
import { EntryBlock } from './entry/Entry'
import type { Deciding } from './entry/parts'
import { blocksOf, messageWords, type Naming } from './entry/words'
import { useComposerState } from './state/useComposerState'
import type { Day } from './timeline/timeline'

/** The day before the oldest one shown, which the reader may ask for. */
interface Earlier {
  /** Reads the latest earlier day holding an Entry. */
  show: () => void
  /** The day is on its way. */
  pending: boolean
}

/** A Message the user sent that the Conversation does not hold yet. */
interface Sending {
  readonly id: number
  readonly text: string
  /** Refused: it shows so, with its retry. */
  readonly refused: boolean
  readonly retry: () => void
}

interface TimelineProps {
  /** The days shown, oldest first, each with its Entries oldest first. */
  days: readonly Day[]
  /** Centers the canvas on a Tile named; none where there is no canvas. */
  onCenter?: ((tile: string) => void) | undefined
  /** An earlier day holding an Entry, when there is one. */
  earlier?: Earlier | undefined
  /** Accepts or discards the open Proposal, or undoes what an accepted one or a Turn applied. */
  decide: Deciding
  /** The System's Tiles now, by id, with their Titles; none before it is read. */
  system?: ReadonlyMap<string, string> | undefined
  /** The user's Messages on their way, or refused, oldest first. */
  sending?: ReadonlyArray<Sending>
  /** The Turn running, its agent's step now, if any. */
  turn?: { readonly step?: TurnStep | undefined } | undefined
  className?: string
}

/** The Mode the Conversation is in, and how to switch it. */
interface ModeChoice {
  mode: Mode
  choose: (mode: Mode) => void
}

interface FootProps {
  /** A Message the user sent, trimmed and never empty, each Tile it `@`s linked by its id. */
  onSend: (text: string) => void
  /** A command the page runs with what the agent does, the Mode and an Undo. */
  onCommand: (command: Exclude<RunCommand, 'language'>) => void
  /** The Tiles the user may `@`. */
  tiles: ReadonlyArray<Mentionable>
  /** Whether something the agent applied may be undone now. */
  undoable?: boolean
  /** The Account may not use the Assistant: its Messages are kept, and no agent answers them. */
  unavailable?: boolean
  /** The Turn running, and how to stop it: the field waits meanwhile. */
  running?: { stop: () => void; stopping: boolean } | undefined
  /** A Message is on its way. */
  sending?: boolean
  /** Nothing can be sent yet, the page still reading what a Message is sent from. */
  waiting?: boolean
  /** The Conversation's Mode and its switch; none before it is read. */
  mode?: ModeChoice | undefined
}

type ConversationProps = Omit<TimelineProps, 'className'> & FootProps & { className?: string }

/** The timeline above its foot, the timeline scrolling, which opens on its newest entry. */
export function Conversation({ className, ...props }: ConversationProps) {
  return (
    <section
      aria-label={m.conversation_label()}
      className={cn('flex min-h-0 flex-col bg-background', className)}
    >
      {/* Laid out in reverse, so the timeline opens scrolled to its newest entry. */}
      <div className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto">
        <Timeline {...props} className="px-4 py-5" />
      </div>
      <ConversationFoot {...props} />
    </section>
  )
}

/**
 * The days, oldest first, the day before asked for above them, or the empty state; then what the user
 * sent that is on its way, and the agent's step; no scroller of its own, so the one screen scrolls it
 * beside its curve.
 */
export function Timeline({
  days,
  onCenter,
  earlier,
  decide,
  system,
  sending = [],
  turn,
  className,
}: TimelineProps) {
  const now = new Date()
  const shown = days.filter((day) => day.entries.length > 0)
  const after = sending.length > 0 || turn !== undefined
  return (
    <div className={cn('grid gap-5', className)}>
      {earlier !== undefined && (
        <Act className="justify-self-center" waits={earlier.pending} onClick={earlier.show}>
          {m.conversation_earlier()}
        </Act>
      )}
      {shown.length === 0 && earlier === undefined && !after ? (
        <EmptyState
          icon={<MessagesSquare />}
          title={m.conversation_empty_title()}
          description={m.conversation_empty_description()}
        />
      ) : (
        shown.map((day) => (
          <section key={day.key} aria-label={dayLabel(day, now)} className="grid gap-5">
            <DaySplit label={dayLabel(day, now)} />
            {blocksOf(day.entries).map((block, index) => (
              // A block is its first Entry's, never moved: a new one only comes after it.
              <EntryBlock
                key={blockKey(block, index)}
                block={block}
                naming={{ titles: day.titles, system, onCenter }}
                decide={decide}
              />
            ))}
          </section>
        ))
      )}
      {after && (
        <Latest
          sending={sending}
          turn={turn}
          today={shown.at(-1)?.relative === 'today'}
          naming={{ titles: Object.fromEntries(system ?? []), system, onCenter }}
        />
      )}
    </div>
  )
}

/** A block's key: its first Entry's id. */
const blockKey = (block: ReturnType<typeof blocksOf>[number], index: number) =>
  block.kind === 'lines' ? (block.entries[0]?.id ?? String(index)) : block.entry.id

/**
 * After the last Entry, under today's split if the last day shown is another: the user's Messages on
 * their way or refused, then the agent's step while a Turn runs, or that it thinks.
 */
function Latest({
  sending,
  turn,
  today,
  naming,
}: {
  sending: ReadonlyArray<Sending>
  turn: TimelineProps['turn']
  today: boolean
  naming: Naming
}) {
  return (
    <>
      {!today && <DaySplit label={m.conversation_today()} />}
      {sending.map((message) => (
        <Message
          key={message.id}
          voice="human"
          words={messageWords(message.text, naming)}
          state={message.refused ? 'failed' : 'sending'}
          onRetry={message.retry}
        />
      ))}
      {turn !== undefined && <Events lines={[stepOf(turn.step)]} />}
    </>
  )
}

/** The agent's step now, as a line breathing on the thread: what on, its tool beside; or it thinks. */
function stepOf(step: TurnStep | undefined): Happened {
  const at = new Date()
  if (step === undefined) {
    return { who: 'agent', words: [m.conversation_thinking()], at, state: 'running' }
  }
  return step.detail === undefined
    ? { who: 'agent', words: [step.tool], at, state: 'running' }
    : { who: 'agent', words: [step.detail], tool: step.tool, at, state: 'running' }
}

function dayLabel(day: Day, now: Date): string {
  if (day.relative === 'today') return m.conversation_today()
  if (day.relative === 'yesterday') return m.conversation_yesterday()
  const year = day.date.getFullYear() === now.getFullYear() ? undefined : 'numeric'
  return new Intl.DateTimeFormat(getLocale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year,
  }).format(day.date)
}

/** Each Mode as the composer offers it: its name under the field, and what it means. */
const modes: ReadonlyArray<{ id: Mode; label: () => string; means: () => string }> = [
  { id: 'ask', label: m.composer_mode_ask, means: m.conversation_mode_ask_hint },
  { id: 'apply', label: m.composer_mode_apply, means: m.conversation_mode_apply_hint },
]

/** The language picked, or named after the language: a plain link to this page in it, a full load. */
function goTo(locale: string) {
  const { pathname, search, hash } = window.location
  window.location.assign(
    localizeHref(`${pathname}${search}${hash}`, { locale: assertIsLocale(locale) }),
  )
}

/**
 * The composer, through its state hook: a pick put in the field, its caret after it, or the language
 * gone to; a Message sent as words, or a command the field opens with run.
 */
export function ConversationFoot({
  onSend,
  onCommand,
  tiles,
  undoable = false,
  unavailable = false,
  running,
  sending = false,
  waiting = false,
  mode,
}: FootProps) {
  const among = offered({ modes: mode !== undefined && !unavailable, undoable } satisfies Offering)
  const { state, actions } = useComposerState(tiles, among)
  const field = useRef<HTMLTextAreaElement>(null)
  return (
    <Composer
      fieldRef={field}
      value={state.value}
      onChange={actions.change}
      marks={state.marks}
      listing={state.typing?.listing}
      onPick={(row) => {
        const picked = actions.pick(row)
        if (picked === undefined) return
        if ('language' in picked) {
          goTo(picked.language)
          return
        }
        const element = field.current
        if (element !== null) {
          // Set on the element first, so React finds it as it is and leaves the caret be.
          element.value = picked.value
          element.setSelectionRange(picked.caret, picked.caret)
        }
      }}
      onLeave={actions.leave}
      onSend={() => {
        const sent = actions.send()
        if ('message' in sent) onSend(sent.message)
        else if (sent.command !== 'language') onCommand(sent.command)
        else {
          const locale = languageNamed(sent.rest)
          if (locale !== undefined) goTo(locale)
        }
      }}
      sending={sending}
      running={running}
      waiting={waiting}
      unavailable={unavailable}
      mode={
        mode === undefined
          ? undefined
          : {
              choices: modes.map(({ id, label, means }) => ({
                id,
                label: label(),
                means: means(),
              })),
              on: mode.mode,
              choose: (id) => {
                const chosen = modes.find((each) => each.id === id)
                if (chosen !== undefined) mode.choose(chosen.id)
              },
            }
      }
    />
  )
}
