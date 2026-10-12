// The deck's frame: a slide of the screen, the chat and the canvas as home has them, the agent telling
// the slide in the chat and the canvas showing what it tells of; the way on, at the foot of what the
// agent says, and the composer, where a `/` lists the slides to go to; the corner, where you are in
// the design system, the slide and its piece, the theme at its head; and the keys, ← and → from one
// slide to the next, wherever no field, list or canvas keeps them.
import {
  Columns2,
  Hexagon,
  Layers,
  ListOrdered,
  MessageSquare,
  MessagesSquare,
  Palette,
  Shapes,
  Sun,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { m } from '#/paraglide/messages'

import { Act, voiceOf } from '../../atoms/controls/act'
import { Rail } from '../../canvas/layouts/Rail'
import { Composer, type Mark } from '../../chat/composer/Composer'
import type { Listing } from '../../chat/composer/List'
import { Message } from '../../chat/text/Message'
import type { Words } from '../../chat/text/words'
import { Screen } from '../../layouts/screen/Screen'
import { useScreenState } from '../../layouts/screen/state/useScreenState'
import type { PieceName } from '../pieces'
import {
  nextOf,
  placeOf,
  previousOf,
  slideIds,
  slideName,
  slideNamed,
  slidesFor,
  slideTitle,
  type SlideId,
} from './slides'

/** Goes to a slide, and, in a chapter, to one of its pieces. */
export type Go = (slide: SlideId, piece?: PieceName) => void

/** A line of what is said in the chat: the agent's, or the reader's own, in their voice. */
export interface Line {
  voice: 'agent' | 'human'
  words: Words
  /** Just written, so the chat scrolls to it. */
  sent?: true
}

/** What the agent says on a slide of the screen, and the reader's line it answers on the chat's. */
const told: Partial<Record<SlideId, ReadonlyArray<{ voice: Line['voice']; say: () => string }>>> = {
  chat: [
    { voice: 'agent', say: m.deck_chat_say_1 },
    { voice: 'human', say: m.deck_chat_ask },
    { voice: 'agent', say: m.deck_chat_answer },
    { voice: 'agent', say: m.deck_chat_say_2 },
  ],
  canvas: [
    { voice: 'agent', say: m.deck_canvas_say_1 },
    { voice: 'agent', say: m.deck_canvas_say_2 },
  ],
  tokens: [
    { voice: 'agent', say: m.deck_tokens_say_1 },
    { voice: 'agent', say: m.deck_tokens_say_2 },
  ],
}

/** What the agent says on a slide, in order; nothing on a slide whose words are its caller's. */
const toldOn = (slide: SlideId): Line[] =>
  (told[slide] ?? []).map(({ voice, say }) => ({ voice, words: [say()] }))

/**
 * The lines of the chat, each voice as the chat draws it, the agent's mark on the first of a run; a
 * line just written shows at once.
 */
export function Lines({ lines }: { lines: readonly Line[] }) {
  return (
    <ol className="flex flex-col gap-[1.375rem]">
      {lines.map((line, index) => (
        // The lines of one telling, never reordered: their place is their key.
        <li
          key={index}
          ref={line.sent ? scrollToFoot : undefined}
          className="motion-safe:animate-rise"
        >
          {line.voice === 'human' ? (
            <Message voice="human" words={line.words} />
          ) : (
            <Message
              voice="agent"
              words={line.words}
              continued={lines[index - 1]?.voice === 'agent'}
            />
          )}
        </li>
      ))}
    </ol>
  )
}

/** A line just written shows at once: its chat, and not the page, scrolls to its foot. */
function scrollToFoot(element: HTMLElement | null) {
  const messages = element?.closest<HTMLElement>('[role="region"]')
  if (messages) messages.scrollTop = messages.scrollHeight
}

interface ScreenSlideProps {
  slide: SlideId
  /** The piece a chapter shows, which the corner names. */
  piece?: PieceName
  onGo: Go
  /** What the chat shows after the agent's words: a chapter's pieces, the gestures told, an end. */
  lines?: ReactNode
  /** The canvas side: a page of words, the canvas itself, a piece's specimens. */
  canvas: ReactNode
  /** The canvas's corner; where you are in the design system when absent. */
  corner?: ReactNode
  /** The chat's foot; the deck's composer when absent, where a `/` lists the slides. */
  composer?: ReactNode
}

/**
 * A slide of the screen: the agent telling it in the chat, then what its caller adds there and the
 * way on, the canvas beside, the corner and the composer. What the reader writes stays in the chat in
 * their voice, and the agent answers that nobody does yet, but where a `/` goes.
 */
export function ScreenSlide(props: ScreenSlideProps) {
  const { slide, piece, onGo, lines, canvas, corner, composer } = props
  const { state: screen, actions: turning } = useScreenState()
  const [written, setWritten] = useState<readonly string[]>([])
  const answered = written.flatMap((text): Line[] => [
    { voice: 'human', words: [text] },
    { voice: 'agent', words: [m.deck_answer()], sent: true },
  ])
  return (
    <Screen
      front={screen.front}
      onFrontChange={turning.turn}
      said={screen.said}
      className="size-full"
      canvas={canvas}
      corner={corner ?? <DeckRail slide={slide} piece={piece} onGo={onGo} />}
      messages={
        <div className="grid gap-[1.375rem]">
          <Lines lines={toldOn(slide)} />
          {lines}
          {answered.length > 0 && <Lines lines={answered} />}
          <WayOn slide={slide} onGo={onGo} />
        </div>
      }
      composer={
        composer ?? (
          <DeckComposer
            onGo={onGo}
            onWrite={(text) => {
              setWritten([...written, text])
            }}
          />
        )
      }
    />
  )
}

/**
 * The way on, at the foot of what the agent says: to the next slide, in its voice, back to the one
 * before, quietly, each with its key; and where the slide stands among them.
 */
export function WayOn({ slide, onGo }: { slide: SlideId; onGo: Go }) {
  const next = nextOf(slide)
  const previous = previousOf(slide)
  return (
    <nav
      aria-label={m.deck_way_label()}
      className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1 motion-safe:animate-rise"
    >
      {next === undefined ? (
        <Act
          tone="voice"
          className={voiceOf('agent')}
          onClick={() => {
            onGo('why')
          }}
        >
          {m.deck_again()}
        </Act>
      ) : (
        <Act
          tone="voice"
          className={voiceOf('agent')}
          shortcut={{ key: 'ArrowRight' }}
          onClick={() => {
            onGo(next)
          }}
        >
          {m.deck_next({ title: slideTitle(next) })}
        </Act>
      )}
      {previous !== undefined && (
        <Act
          shortcut={{ key: 'ArrowLeft' }}
          onClick={() => {
            onGo(previous)
          }}
        >
          {m.deck_back()}
        </Act>
      )}
      <span className="ml-auto font-agent text-[0.6875rem] text-faint">
        {m.deck_place({ at: placeOf(slide), of: slideIds.length })}
      </span>
    </nav>
  )
}

interface DeckRailProps {
  slide: SlideId
  /** The piece a chapter shows, the last step. */
  piece?: PieceName | undefined
  onGo: Go
  className?: string
}

/**
 * The corner: where you are, as the canvas's corner says it, from the design system down to the slide
 * and the piece it shows, the theme at its head; a step up goes there, the design system to its
 * first slide, a chapter to its first piece.
 */
export function DeckRail({ slide, piece, onGo, className }: DeckRailProps) {
  const steps = [
    { id: deckStep, title: m.design_system_title() },
    { id: slide, title: slideTitle(slide) },
    ...(piece === undefined ? [] : [{ id: piece, title: piece }]),
  ]
  return (
    <Rail
      steps={steps}
      onSelect={(id) => {
        const step = slideIds.find((each) => each === id)
        if (id === deckStep) onGo('why')
        else if (step !== undefined) onGo(step)
      }}
      className={className}
    />
  )
}

/** The design system's own step on the corner, which no slide shares. */
const deckStep = 'design-system'

const icons: Record<SlideId, LucideIcon> = {
  why: Sun,
  principles: ListOrdered,
  chat: MessageSquare,
  canvas: Hexagon,
  crossings: Columns2,
  'chat-pieces': MessagesSquare,
  'canvas-pieces': Shapes,
  shared: Layers,
  tokens: Palette,
}

/** The slides a `/` and the word after it find, as the composer lists them; none for anything else. */
function listingOf(value: string): Listing | undefined {
  const typed = /^\/(\S*)$/.exec(value)?.[1]
  if (typed === undefined) return undefined
  return {
    label: m.deck_composer_label(),
    typed,
    groups: [
      {
        label: m.deck_composer_group(),
        rows: slidesFor(typed).map((slide) => ({
          kind: 'command' as const,
          id: slide,
          name: slideName(slide),
          does: slideTitle(slide),
          icon: icons[slide],
        })),
      },
    ],
    none: m.deck_composer_none(),
    tip: m.deck_composer_tip(),
  }
}

/** The slide the field names, `/` and its name, marked as a command is. */
function marksOf(value: string): Mark[] {
  const named = /^\/(\S+)/.exec(value)
  return named !== null && slideNamed(named[1] ?? '') !== undefined
    ? [{ from: 0, to: named[0].length, kind: 'command' }]
    : []
}

/**
 * The composer at the chat's foot, as home's: a `/` lists the slides, which a pick or `/name` and
 * Enter go to; anything else is written in the chat, in the reader's voice.
 */
function DeckComposer({ onGo, onWrite }: { onGo: Go; onWrite: (text: string) => void }) {
  const [value, setValue] = useState('')
  const [left, setLeft] = useState(false)
  const go = (slide: SlideId) => {
    setValue('')
    onGo(slide)
  }
  return (
    <Composer
      value={value}
      onChange={(next) => {
        setValue(next)
        setLeft(false)
      }}
      marks={marksOf(value)}
      listing={left ? undefined : listingOf(value)}
      onPick={(row) => {
        const slide = slideIds.find((each) => each === row)
        if (slide !== undefined) go(slide)
      }}
      onLeave={() => {
        setLeft(true)
      }}
      placeholder={m.deck_composer_placeholder()}
      onSend={() => {
        const text = value.trim()
        const named = text.startsWith('/') ? slideNamed(text.slice(1)) : undefined
        if (named !== undefined) {
          go(named)
          return
        }
        setValue('')
        onWrite(text)
      }}
    />
  )
}

/**
 * ← and → go from one slide to the next, and so do Page Up and Page Down, wherever no field, list,
 * menu, dialog or canvas keeps the arrows for itself.
 */
export function useDeckKeys(slide: SlideId, onGo: Go) {
  const latest = useRef({ slide, onGo })
  useEffect(() => {
    latest.current = { slide, onGo }
  })
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
      if (event.shiftKey || keepsTheKeys(event.target)) return
      const now = latest.current.slide
      const to =
        event.key === 'ArrowRight' || event.key === 'PageDown'
          ? nextOf(now)
          : event.key === 'ArrowLeft' || event.key === 'PageUp'
            ? previousOf(now)
            : undefined
      if (to === undefined) return
      event.preventDefault()
      latest.current.onGo(to)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [])
}

/** What keeps the arrows for itself: a field, a list, a menu, a radio group, a dialog, the canvas. */
const keeping =
  'input, textarea, select, [contenteditable], [role=listbox], [role=combobox], [role=menu], [role=menuitem], [role=radiogroup], [role=slider], [role=dialog], [role=alertdialog], svg'

function keepsTheKeys(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(keeping) !== null
}
