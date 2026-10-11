// The agent's thinking, quieter than its words: smaller, fainter, on a dotted violet line. Live, its
// last lines scroll past under "Thinking"; once the answer comes it folds into one line that says how
// long it thought, open on a click (`Fold`).
import { cn } from 'cn'
import { Sparkle } from 'lucide-react'

import { m } from '#/paraglide/messages'

import { Fold } from '../atoms/controls'

interface ThinkingProps {
  /** Under way, or done once the answer came. */
  state: 'live' | 'done'
  /** How long it has thought, or thought. */
  seconds: number
  text: string
}

const line = 'border-l border-dotted border-agent/45 pl-3 whitespace-pre-wrap wrap-anywhere'

export function Thinking({ state, seconds, text }: ThinkingProps) {
  return (
    <div className="grid grid-cols-[0.875rem_minmax(0,1fr)] gap-x-2.5 font-agent text-xs leading-relaxed text-faint">
      {state === 'live' ? (
        <Live seconds={seconds} text={text} />
      ) : (
        <Done seconds={seconds} text={text} />
      )}
    </div>
  )
}

function Live({ seconds, text }: Omit<ThinkingProps, 'state'>) {
  return (
    <>
      <span className="mt-[.5em] size-1.5 justify-self-center rounded-full bg-agent shadow-[0_0_10px_1px_var(--color-agent)] [animation-duration:2.4s] motion-safe:animate-breathe" />
      <div aria-busy>
        <p className="text-agent">{m.chat_thinking({ seconds })}</p>
        {/* Its last three lines, the older ones fading out at the top as new ones push them up. */}
        <p
          className={cn(
            line,
            'mt-1.5 flex max-h-[4.8em] flex-col justify-end overflow-hidden [mask-image:linear-gradient(transparent,currentColor_1.6em)]',
          )}
        >
          <span>{text}</span>
        </p>
      </div>
    </>
  )
}

function Done({ seconds, text }: Omit<ThinkingProps, 'state'>) {
  return (
    <>
      <Sparkle aria-hidden className="mt-[.3em] size-3 justify-self-center" />
      <div>
        <Fold label={m.chat_thought({ seconds })}>
          <p className={cn(line, 'mt-1.5')}>{text}</p>
        </Fold>
      </div>
    </>
  )
}
