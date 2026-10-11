import { cn } from 'cn'
import type { ComponentProps } from 'react'

import { ariaShortcut, Keys, type Shortcut } from '../keys'

type Tone = 'quiet' | 'voice' | 'destructive'

/** Whose a surface is, which its `voice` actions speak in: the agent's, the human's, the app's, or lost. */
export type Voice = 'agent' | 'human' | 'app' | 'destructive'

const voices: Record<Voice, string> = {
  agent: '[--voice:var(--agent)]',
  human: '[--voice:var(--human)]',
  app: '[--voice:var(--foreground)]',
  destructive: '[--voice:var(--destructive)]',
}

/** The class a surface takes so the `Act`s on it, and its own lines, speak in its voice. */
export const voiceOf = (voice: Voice) => voices[voice]

interface ActProps extends ComponentProps<'button'> {
  /**
   * `text`, a quiet action led by a small hex; `hex`, the one solid action a dialog or a form asks for,
   * a light cut as a long hex, not a box.
   */
  look?: 'text' | 'hex'
  /**
   * `quiet` in the muted ink; `voice` in the voice of the surface it sits on (`voiceOf`), for the
   * action it expects; `destructive` for what is lost.
   */
  tone?: Tone
  /** Its shortcut, drawn after its word so the action teaches it. Whoever owns the key binds it. */
  shortcut?: Shortcut
}

// The ink of a text action, and the light a solid one is cut from.
const textTones: Record<Tone, string> = {
  quiet: 'text-muted-foreground',
  voice: 'text-(--voice)',
  destructive: 'text-destructive',
}
const hexTones: Record<Tone, string> = {
  quiet: '[--act:var(--voice,var(--foreground))] bg-(--act)/16 text-(--act) hover:bg-(--act)/26',
  voice: '[--act:var(--voice,var(--foreground))] bg-(--act) text-background hover:bg-(--act)/86',
  destructive: '[--act:var(--destructive)] bg-(--act) text-background hover:bg-(--act)/86',
}

/** An action in a widget, a dialog or a receipt: a word you click, never a boxed button. */
export function Act({
  look = 'text',
  tone = 'quiet',
  shortcut,
  className,
  children,
  type = 'button',
  ...props
}: ActProps) {
  return (
    <button
      type={type}
      aria-keyshortcuts={shortcut && ariaShortcut(shortcut)}
      className={cn(
        'inline-flex cursor-pointer items-center gap-2 text-[0.8125rem] whitespace-nowrap transition-colors focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-(--voice,var(--human)) disabled:cursor-default pointer-coarse:min-h-11',
        look === 'text'
          ? [
              textTones[tone],
              'before:size-2 before:shrink-0 before:bg-current before:[clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)] hover:text-foreground disabled:text-faint disabled:opacity-60',
            ]
          : [
              hexTones[tone],
              'h-[2.125rem] px-5 [clip-path:polygon(9px_0,calc(100%-9px)_0,100%_50%,calc(100%-9px)_100%,9px_100%,0_50%)] disabled:opacity-35 pointer-coarse:h-11',
            ],
        className,
      )}
      {...props}
    >
      {children}
      {shortcut !== undefined && (
        <span className="ml-0.5">
          <Keys shortcut={shortcut} />
        </span>
      )}
    </button>
  )
}
