// An action in the chat's flow, as text: a small hex, then what it does. The one a piece expects is in
// its voice, the agent's violet or the human's amber; the others stay quiet until pointed at. Light,
// not a box, so the chat's actions never read as a form's buttons.
import { cn } from 'cn'
import type { ComponentProps } from 'react'

import { HexMark } from './hex'

/** Whose action it is: the agent's, the user's, one that destroys, or a quiet one. */
type Tone = 'quiet' | 'agent' | 'human' | 'destructive'

const tones: Record<Tone, string> = {
  quiet: 'text-muted-foreground',
  agent: 'text-agent',
  human: 'text-human',
  destructive: 'text-destructive',
}

interface ActProps extends ComponentProps<'button'> {
  tone?: Tone
}

/** A text button with its hex, in its tone; a finger gets a target of 44px. */
export function Act({ tone = 'quiet', type, className, children, ...props }: ActProps) {
  return (
    <button
      // A button submits a surrounding form only when it says so.
      type={type ?? 'button'}
      className={cn(
        'inline-flex items-center gap-2 font-sans text-[0.8125rem] whitespace-nowrap transition-colors outline-offset-4 hover:text-foreground focus-visible:outline disabled:cursor-default disabled:text-faint disabled:opacity-60 pointer-coarse:min-h-11',
        tones[tone],
        className,
      )}
      {...props}
    >
      <HexMark className="size-2.5" />
      {children}
    </button>
  )
}
