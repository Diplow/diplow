// A tile named in the chat, wherever it is: its title, a small hex before it, a faint underline. A
// click centers the canvas on it. Hovered, or focused from the keyboard, it opens the tile's card, as
// the tile itself does on the canvas, above its line, whose next words stay within reach, and tells
// its caller it is pointed at, which the canvas lights
// (a crossing, HEX-108). A tile the agent drafts is violet until it exists; a deleted one is struck
// through and goes nowhere.
import { cn } from 'cn'
import type { ComponentProps } from 'react'

import { m } from '#/paraglide/messages'

import type { Voice as AnyVoice } from '../../atoms/controls/act'
import { HoverCard } from '../../layouts/HoverCard'
import { HexMark } from '../atoms/hex'

/** Whose words they are: the chat's two voices, the user's and the agent's. */
export type Voice = Extract<AnyVoice, 'human' | 'agent'>

/** What a named tile is to the reader: there, the agent's draft, or deleted since. */
type Standing = 'live' | 'draft' | 'gone'

/** What a tile named shows in its card, beside its title: what the canvas's card says of the tile. */
type MentionCard = Pick<ComponentProps<typeof HoverCard>, 'place' | 'description' | 'notes'>

export interface MentionProps {
  title: string
  standing?: Standing
  /** Centers the canvas on it; none where nothing can be centered, and none once it is gone. */
  onCenter?: (() => void) | undefined
  /** Its card, hovered or focused; none where the page knows nothing more of it, and once gone. */
  card?: MentionCard | undefined
  /** Its card opened or shut: the tile is pointed at meanwhile, which the canvas lights. */
  onPoint?: ((pointing: boolean) => void) | undefined
}

interface Voiced extends MentionProps {
  /** Whose words name it: in the user's, its hex is amber. */
  voice?: Voice | undefined
}

export function Mention({ title, standing = 'live', onCenter, card, onPoint, voice }: Voiced) {
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
  const named =
    onCenter === undefined ? (
      <span className={look}>
        {mark}
        {title}
      </span>
    ) : (
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
  if (card === undefined) return named
  return (
    <HoverCard
      side="top"
      place={card.place}
      title={title}
      {...(card.description !== undefined && { description: card.description })}
      {...(card.notes !== undefined && { notes: card.notes })}
      onOpenChange={onPoint}
    >
      {named}
    </HoverCard>
  )
}
