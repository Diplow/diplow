// The two voices. The user's words in Newsreader, light and large, behind a fine amber line; the
// agent's in Geist Mono, smaller, in the second ink, behind a violet hex outline. While the user's are
// sending the line dims and the words wait in grey; failed, the line turns destructive with a retry.
// While the agent's are coming each word inks in from a slight blur, and a small violet hex breathes
// where the next will land. Both copy from the edge of the column.
import { cn } from 'cn'
import { Copy } from 'lucide-react'

import { m } from '#/paraglide/messages'

import { Button } from '../../atoms/controls/button'
import { toast } from '../../atoms/Toaster'
import { Act } from '../atoms/Act'
import { HexMark } from '../atoms/hex'
import { plainOf, Said, type Words } from './words'

interface HumanProps {
  voice: 'human'
  words: Words
  /** Sent, the default; on its way; or refused, with its retry. */
  state?: 'sent' | 'sending' | 'failed'
  onRetry?: () => void
}

interface AgentProps {
  voice: 'agent'
  words: Words
  /** Done, the default, or still coming, word after word. */
  state?: 'done' | 'streaming'
  /** It follows another of the agent's: the mark stays on the first of a run only. */
  continued?: boolean
}

export type MessageProps = HumanProps | AgentProps

export function Message(props: MessageProps) {
  return props.voice === 'human' ? <Human {...props} /> : <Agent {...props} />
}

function Human({ words, state = 'sent', onRetry }: HumanProps) {
  return (
    <div className="group grid max-w-[36em] grid-cols-[minmax(0,1fr)_auto] gap-x-2">
      <p
        className={cn(
          'border-l pl-3.5 font-human text-prose font-light whitespace-pre-wrap wrap-anywhere transition-colors duration-400',
          state === 'sent' && 'border-human/70 text-foreground',
          state === 'sending' && 'border-human/25 text-muted-foreground',
          state === 'failed' && 'border-destructive text-foreground',
        )}
      >
        <span className="sr-only">{m.chat_you_said()} </span>
        <Said words={words} voice="human" />
        {state === 'sending' && <span className="sr-only"> ({m.chat_message_sending()})</span>}
      </p>
      <CopyTool words={words} />
      {state === 'failed' && (
        <p className="flex flex-wrap items-center gap-x-3.5 pt-1.5 pl-3.5 text-xs text-destructive">
          <span>{m.chat_message_failed()}</span>
          {onRetry !== undefined && (
            <Act className="text-xs" onClick={onRetry}>
              {m.chat_message_retry()}
            </Act>
          )}
        </p>
      )}
    </div>
  )
}

function Agent({ words, state = 'done', continued = false }: AgentProps) {
  const streaming = state === 'streaming'
  return (
    <div
      aria-busy={streaming}
      className="group grid max-w-[36em] grid-cols-[0.875rem_minmax(0,1fr)_auto] gap-x-2.5 font-agent text-mono text-muted-foreground"
    >
      <HexMark
        flat
        hollow
        className={cn('mt-[.3em] size-3.5 text-agent', continued && 'invisible')}
      />
      <p className="whitespace-pre-wrap wrap-anywhere">
        <span className="sr-only">{m.chat_agent_said()} </span>
        {streaming ? <Inking words={words} /> : <Said words={words} voice="agent" />}
        {streaming && (
          <HexMark className="ml-1 size-2 text-agent drop-shadow-[0_0_4px_var(--color-agent)] [animation-duration:1.1s] motion-safe:animate-breathe" />
        )}
      </p>
      {!streaming && <CopyTool words={words} />}
    </div>
  )
}

/** Words still coming: each inks in from a slight blur as it lands, the words before it staying put. */
function Inking({ words }: { words: Words }) {
  const ink =
    'motion-safe:animate-in motion-safe:fade-in motion-safe:blur-in-[2px] animation-duration-350'
  return words.flatMap((word, index) => {
    if (typeof word !== 'string') {
      // A tile or a name lands whole. Each piece keeps its place: what has come never moves.
      return [
        <span key={index} className={ink}>
          <Said words={[word]} voice="agent" />
        </span>,
      ]
    }
    return word.split(/(\s+)/).map((part, at) => (
      <span key={`${String(index)}-${String(at)}`} className={ink}>
        {part}
      </span>
    ))
  })
}

/** Copies the words, each tile by its title; shown on hover or focus, always under a finger. */
function CopyTool({ words }: { words: Words }) {
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label={m.chat_copy()}
      className="text-faint opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:size-11 pointer-coarse:opacity-100"
      onClick={() => {
        // Without a secure context there is no clipboard: that fails as a refused copy does.
        void Promise.resolve(plainOf(words))
          .then((text) => navigator.clipboard.writeText(text))
          .then(
            () => toast(m.chat_copied()),
            () => toast.error(m.chat_copy_failed()),
          )
      }}
    >
      <Copy aria-hidden />
    </Button>
  )
}
