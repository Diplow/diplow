// What a decision leaves in the conversation once the widget that asked for it gives its surface back:
// one line, a small hex in the agent's voice, what was done, its Undo while one is possible, the time,
// and its changes, folded, one on a line below it once opened. An accepted Proposal and a Turn that
// applied its changes leave one alike; a discarded Proposal one with what it would have changed; once
// undone, it says so. Its Undo speaks up when it changes, so a screen reader hears the undoing land, and it keeps the focus its
// Undo had once that is gone. Arriving, it says nothing itself: whoever swaps it in announces it, as the
// Proposal does, or the conversation's log.
import { cn } from 'cn'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { m } from '#/paraglide/messages'

import { Act } from '../../atoms/controls/act'
import { focusHeld, focusLost, giveFocusBack } from '../../focus'
import { Fold } from '../atoms/fold'
import { HexMark } from '../atoms/hex'
import { useHandOffState } from '../layouts/useHandOffState'
import { plainOf, Said, type Words } from '../text/words'
import { Time } from './time'

/** One change a decision makes: its verb's icon and what it does. */
export interface Change {
  icon: LucideIcon
  words: Words
}

/** The changes of one decision, each on a line, its icon in violet. */
export function Changes({
  changes,
  className,
}: {
  changes: readonly Change[]
  className?: string
}) {
  return (
    <ul className={cn('grid gap-2 font-light text-muted-foreground', className)}>
      {changes.map(({ icon: Icon, words }, index) => (
        // The changes of one decision, never reordered: their place is their key.
        <li key={index} className="grid grid-cols-[0.875rem_minmax(0,1fr)] gap-2.5 leading-snug">
          <Icon aria-hidden strokeWidth={1.4} className="mt-0.5 size-3.5 text-agent" />
          <span className="wrap-anywhere">
            <Said words={words} voice="agent" />
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Its hex, in the voice of whoever did it. */
const marks = {
  agent: 'fill-agent/20 stroke-agent',
  human: 'fill-human/20 stroke-human',
  app: 'fill-foreground/14 stroke-foreground',
  quiet: 'stroke-faint',
} as const

interface ReceiptProps {
  words: Words
  at: Date
  /** What it changed, or would have: folded under its line. */
  changes?: readonly Change[]
  /**
   * Whose doing it was, in their voice: the agent's, the user's (a tile they wrote), the app's (a Key
   * issued); or what came to nothing, quiet.
   */
  tone?: 'agent' | 'human' | 'app' | 'quiet'
  /** Puts the System back as it stood; none where nothing can be undone. */
  onUndo?: (() => void) | undefined
  /** A decision on its way: the Undo waits. */
  pending?: boolean
  undone?: boolean
  /** It takes the focus as it comes: the widget that asked had it, and is gone. */
  takesFocus?: boolean
}

export function Receipt({
  words,
  at,
  changes = [],
  tone = 'agent',
  onUndo,
  pending = false,
  undone = false,
  takesFocus = false,
}: ReceiptProps) {
  const line = useRef<HTMLDivElement>(null)
  const undoFocused = useRef(false)
  useEffect(() => {
    if (takesFocus) line.current?.focus()
  }, [takesFocus])
  // Undone, the Undo is gone: had it the focus, the line takes it rather than the page.
  useEffect(() => {
    if (undone && undoFocused.current) line.current?.focus()
  }, [undone])
  return (
    <div
      ref={line}
      tabIndex={-1}
      className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-agent text-[0.78125rem] leading-normal text-muted-foreground outline-none"
    >
      <HexMark
        hollow={tone === 'quiet'}
        className={cn('size-3.5', marks[tone], undone && 'fill-none')}
      />
      <span className={cn('min-w-0 wrap-anywhere', undone && 'text-faint')}>
        <Said words={words} voice={tone === 'human' ? 'human' : 'agent'} />
      </span>
      {/* Only what changes speaks up: the time, written once hydrated, stays out of it. */}
      <span aria-live="polite" className="inline-flex items-center">
        {undone ? (
          <span className="text-faint">· {m.chat_receipt_undone()}</span>
        ) : (
          onUndo !== undefined && (
            <Act
              className="ml-1.5 text-[0.78125rem]"
              waits={pending}
              onClick={onUndo}
              onFocus={() => {
                undoFocused.current = true
              }}
              onBlur={() => {
                undoFocused.current = false
              }}
            >
              {m.ui_undo()}
            </Act>
          )
        )}
      </span>
      <Time at={at} />
      {/* Last, so the keys and a screen reader reach what it opens as the eye does, below the line. */}
      {changes.length > 0 && (
        <Fold
          label={
            <>
              <span aria-hidden>·</span>
              {m.chat_receipt_changes()}
            </>
          }
          panelClassName="basis-full pt-1.5 pb-1 pl-6"
        >
          <Changes changes={changes} />
        </Fold>
      )}
    </div>
  )
}

interface UntilDecidedProps {
  /** Its receipt once decided; none while it still asks. */
  receipt: Omit<ReceiptProps, 'takesFocus'> | undefined
  /** What asks: a widget, open. */
  children: ReactNode
}

/**
 * What asks until it is decided, then the receipt it leaves. Decided from inside, the focus it held
 * goes to the receipt, so the keyboard never falls back to the top of the page; decided elsewhere, the
 * focus stays where the user is and a status says it (`useHandOffState`). While it asks, a step of its
 * own that takes away what had the focus (a Key's name giving way to its secret) gives
 * the focus to its first control rather than to the page. Left with nothing decided, a Cancel, it
 * goes, and the focus it held goes back to what had it as it opened, the tile it edits included.
 */
export function UntilDecided({ receipt, children }: UntilDecidedProps) {
  const { handOff, status, focused, onFocus, onBlur } = useHandOffState(
    receipt === undefined ? 'open' : 'decided',
    receipt === undefined ? '' : plainOf(receipt.words),
  )
  const asking = useRef<HTMLDivElement>(null)
  // The focus counted inside yet fallen to the page: a step of its own removed what held it.
  useEffect(() => {
    if (!focused || document.activeElement !== document.body) return
    asking.current?.querySelector<HTMLElement>('input, textarea, button, [tabindex="0"]')?.focus()
  })
  useFocusGivenBack(focused)
  return (
    <>
      {receipt === undefined ? (
        // The focus is the widget's, or a dialog's it opened, whose events reach here through React's tree.
        <div ref={asking} onFocus={onFocus} onBlur={onBlur}>
          {children}
        </div>
      ) : (
        <Receipt {...receipt} takesFocus={handOff} />
      )}
      {/* Here from the start, so a screen reader hears what it comes to say. */}
      <p role="status" className="sr-only">
        {status}
      </p>
    </>
  )
}

/**
 * What had the focus as it opened, given the focus back once it goes holding it, so a way out that
 * leaves nothing behind doesn't drop the keyboard to the top of the page; unless the focus went
 * somewhere meanwhile, or what had it is gone too.
 */
function useFocusGivenBack(focused: boolean) {
  const [opener] = useState(focusHeld)
  const holds = useRef(focused)
  useEffect(() => {
    holds.current = focused
  })
  useEffect(
    () => () => {
      if (holds.current && focusLost()) giveFocusBack(opener)
    },
    [opener],
  )
}
