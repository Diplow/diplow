// A tile named in the chat, wherever it is: its title, a small hex before it, a faint underline. A
// click centers the canvas on it. A tile the agent drafts is violet until it exists; a deleted one is
// struck through and goes nowhere.
import { cn } from 'cn'

import { m } from '#/paraglide/messages'

import type { Voice as AnyVoice } from '../../atoms/controls/act'
import { HexMark } from '../atoms/hex'

/** Whose words they are: the chat's two voices, the user's and the agent's. */
export type Voice = Extract<AnyVoice, 'human' | 'agent'>

/** What a named tile is to the reader: there, the agent's draft, or deleted since. */
type Standing = 'live' | 'draft' | 'gone'

export interface MentionProps {
  title: string
  standing?: Standing
  /** Centers the canvas on it; none where nothing can be centered, and none once it is gone. */
  onCenter?: (() => void) | undefined
}

interface Voiced extends MentionProps {
  /** Whose words name it: in the user's, its hex is amber. */
  voice?: Voice | undefined
}

export function Mention({ title, standing = 'live', onCenter, voice }: Voiced) {
  const look = cn(
    'group/mention whitespace-nowrap underline decoration-1 underline-offset-3 transition-[text-decoration-color]',
    standing === 'live' && 'text-foreground decoration-foreground/20 hover:decoration-current',
    standing === 'draft' && 'text-agent decoration-agent/30 hover:decoration-current',
    standing === 'gone' && 'text-faint line-through decoration-faint',
  )
  const mark = (
    <HexMark
      hollow={standing === 'gone'}
      className={cn(
        'mr-[.3em] size-[.6em] align-[-.02em] transition-colors',
        standing === 'live' &&
          (voice === 'human'
            ? 'text-human/70 group-hover/mention:text-human'
            : 'text-foreground/40 group-hover/mention:text-foreground'),
        standing === 'draft' && 'text-agent',
        standing === 'gone' && 'text-faint',
      )}
    />
  )
  if (standing === 'gone') {
    return (
      <span className={look}>
        {mark}
        {title}
        <span className="sr-only"> ({m.chat_mention_gone()})</span>
      </span>
    )
  }
  if (onCenter === undefined) {
    return (
      <span className={look}>
        {mark}
        {title}
      </span>
    )
  }
  return (
    <button
      type="button"
      aria-label={m.hex_tile_center({ title })}
      className={cn(
        look,
        // Inline, it cannot grow to a finger's 44px; its hit area does, beyond its line.
        'relative cursor-pointer outline-offset-2 focus-visible:outline pointer-coarse:after:absolute pointer-coarse:after:-inset-x-1 pointer-coarse:after:-inset-y-3',
      )}
      onClick={onCenter}
    >
      {mark}
      {title}
    </button>
  )
}
