// The chat's controls, set as text. An action: a small hex, then what it does, the one a piece expects
// in its voice, the agent's violet or the human's amber, the others quiet until pointed at. A fold:
// what it hides, said in one line in the second ink, a chevron turning as it opens. Light, not a box,
// so the chat's controls never read as a form's buttons; a finger gets a target of 44px.
import { cn } from 'cn'
import { ChevronRight } from 'lucide-react'
import { type ComponentProps, type ReactNode, useId, useState } from 'react'

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

interface FoldProps {
  /** The one line that says what it hides. */
  label: ReactNode
  /** Its type, `font-mono text-xs`; its ink is the second, as a control's. */
  className?: string
  /** What it hides until opened. */
  children: ReactNode
}

/** One line that opens on a click what it hides below it, and folds it back. */
export function Fold({ label, className, children }: FoldProps) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        className={cn(
          'flex items-center gap-2 text-muted-foreground outline-offset-2 transition-colors hover:text-foreground focus-visible:outline pointer-coarse:min-h-11',
          className,
        )}
        onClick={() => {
          setOpen(!open)
        }}
      >
        {label}
        <ChevronRight
          aria-hidden
          className={cn(
            'size-3 transition-transform duration-300 ease-glide motion-reduce:transition-none',
            open && 'rotate-90',
          )}
        />
      </button>
      <div id={id} hidden={!open}>
        {children}
      </div>
    </>
  )
}
