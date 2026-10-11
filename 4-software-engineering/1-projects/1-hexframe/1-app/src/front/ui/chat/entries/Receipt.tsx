// What a decision leaves in the conversation once the widget that asked for it gives its surface back:
// one line, a small hex in the agent's voice, what was done, its Undo while one is possible, and the
// time. An accepted Proposal and a Turn that applied its changes leave one alike; once undone, it says
// so. Its Undo speaks up when it changes, so a screen reader hears the undoing land, and it keeps the focus its
// Undo had once that is gone. Arriving, it says nothing itself: whoever swaps it in announces it, as the
// Proposal does, or the conversation's log.
import { cn } from 'cn'
import { useEffect, useRef } from 'react'

import { m } from '#/paraglide/messages'

import { Act } from '../atoms/controls'
import { HexMark } from '../atoms/hex'
import { Said, type Words } from '../text/words'
import { Time } from './time'

interface ReceiptProps {
  words: Words
  at: Date
  /** What the agent did, in its voice; or what came to nothing, quiet. */
  tone?: 'agent' | 'quiet'
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
  tone = 'agent',
  onUndo,
  pending = false,
  undone = false,
  takesFocus = false,
}: ReceiptProps) {
  const line = useRef<HTMLParagraphElement>(null)
  const undoFocused = useRef(false)
  useEffect(() => {
    if (takesFocus) line.current?.focus()
  }, [takesFocus])
  // Undone, the Undo is gone: had it the focus, the line takes it rather than the page.
  useEffect(() => {
    if (undone && undoFocused.current) line.current?.focus()
  }, [undone])
  return (
    <p
      ref={line}
      tabIndex={-1}
      className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-agent text-[0.78125rem] leading-normal text-muted-foreground outline-none"
    >
      <HexMark
        hollow={tone === 'quiet'}
        className={cn(
          'size-3.5',
          tone === 'agent' ? 'fill-agent/20 stroke-agent' : 'stroke-faint',
          undone && 'fill-none',
        )}
      />
      <span className={cn('min-w-0 wrap-anywhere', undone && 'text-faint')}>
        <Said words={words} voice="agent" />
      </span>
      {/* Only what changes speaks up: the time, written once hydrated, stays out of it. */}
      <span aria-live="polite" className="inline-flex items-center">
        {undone ? (
          <span className="text-faint">· {m.chat_receipt_undone()}</span>
        ) : (
          onUndo !== undefined && (
            <Act
              className="ml-1.5 text-[0.78125rem]"
              disabled={pending}
              onClick={onUndo}
              onFocus={() => {
                undoFocused.current = true
              }}
              onBlur={() => {
                undoFocused.current = false
              }}
            >
              {m.chat_receipt_undo()}
            </Act>
          )
        )}
      </span>
      <Time at={at} />
    </p>
  )
}
