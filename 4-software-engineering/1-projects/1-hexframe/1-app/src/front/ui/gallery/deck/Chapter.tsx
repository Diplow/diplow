// A chapter of the deck, the pieces of a tier or a few, one at a time. The chat tells the chapter,
// lists its pieces, the one shown lit, and tells that one: what it is for, what it is made of and
// where it is used, or, a crossing, what it joins in the chat and on the canvas, each a way to that
// piece. The canvas gives way to the piece's specimens, on a stage of their own; a crossing takes the
// whole screen instead, its end in the chat after its words, its composer at the chat's foot.
import { cn } from 'cn'
import type { ReactNode } from 'react'

import { m } from '#/paraglide/messages'

import { Message } from '../../chat/text/Message'
import { ShowingPiece, tierNote, tierTitle } from '../frame'
import { pieceNamed, pieces, usedIn, type PieceName, type Tier } from '../pieces'
import { ScreenSlide, type Go } from './Deck'
import { chapterOf, piecesOf, tiersOf, type ChapterId } from './slides'

interface ChapterSlideProps {
  chapter: ChapterId
  /** The piece shown, one of the chapter's. */
  piece: PieceName
  onGo: Go
  /** The galleries of the chapter's tiers, of which the piece's specimens alone are drawn. */
  specimens?: ReactNode
  /** A crossing on the whole screen: its end on the canvas, its end in the chat, its composer. */
  crossing?: { canvas: ReactNode; end?: ReactNode; composer?: ReactNode; tryIt: string }
}

export function ChapterSlide({ chapter, piece, onGo, specimens, crossing }: ChapterSlideProps) {
  return (
    <ScreenSlide
      slide={chapter}
      piece={piece}
      onGo={onGo}
      lines={
        <>
          <Told chapter={chapter} />
          <Pieces chapter={chapter} shown={piece} onGo={onGo} />
          <PieceWords piece={piece} onGo={onGo} tryIt={crossing?.tryIt} />
          {crossing?.end}
        </>
      }
      canvas={
        crossing === undefined ? (
          <ShowingPiece piece={piece}>
            <Stage kicker={tierTitle(pieceNamed(piece).tier)} title={piece}>
              {specimens}
            </Stage>
          </ShowingPiece>
        ) : (
          <div className="flex min-w-0 flex-1 flex-col items-center justify-center p-4 pt-20">
            {crossing.canvas}
          </div>
        )
      }
      composer={crossing?.composer}
    />
  )
}

/** What the agent says of a chapter: what each of its tiers holds. */
function Told({ chapter }: { chapter: ChapterId }) {
  const tiers = tiersOf(chapter)
  return (
    <Message
      voice="agent"
      words={[
        tiers.map(tierNote).join(' '),
        ' ',
        chapter === 'crossings' ? m.deck_chapter_try() : m.deck_chapter_pick(),
      ]}
    />
  )
}

/**
 * A chapter's pieces, by tier where it holds more than one, each a way to it, the one shown lit by the
 * reader's amber line, as the composer's list lights the row they are on.
 */
function Pieces({ chapter, shown, onGo }: { chapter: ChapterId; shown: PieceName; onGo: Go }) {
  const tiers = tiersOf(chapter)
  const all = piecesOf(chapter)
  return (
    <nav aria-label={m.deck_pieces_label()} className="grid gap-4 motion-safe:animate-rise">
      {tiers.map((tier) => (
        <div key={tier} className="grid gap-2">
          {tiers.length > 1 && (
            <p className="font-agent text-[0.6875rem] text-faint">{tierTitle(tier)}</p>
          )}
          <ul className="flex flex-wrap gap-x-1 gap-y-1">
            {all
              .filter((name) => tierOf(name) === tier)
              .map((name) => (
                <li key={name}>
                  <PieceWay name={name} shown={name === shown} onGo={onGo} />
                </li>
              ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

const tierOf = (name: PieceName): Tier => pieceNamed(name).tier

/** Whether a name is a piece's: every name the catalogue joins is, which its test holds. */
const isPiece = (name: string): name is PieceName => pieces.some((piece) => piece.name === name)

/** A way to a piece, by its name in mono, lit while it is the one shown. */
function PieceWay({ name, shown, onGo }: { name: PieceName; shown: boolean; onGo: Go }) {
  return (
    <button
      type="button"
      aria-current={shown ? 'true' : undefined}
      onClick={() => {
        onGo(chapterOf(name), name)
      }}
      className={cn(
        'border-b px-2 py-1 font-mono text-[0.78125rem] transition-colors outline-none focus-visible:bg-foreground/7 pointer-coarse:min-h-11',
        shown
          ? 'border-human text-foreground'
          : 'border-transparent text-muted-foreground hover:border-input hover:text-foreground',
      )}
    >
      {name}
    </button>
  )
}

/**
 * What the agent says of the piece shown: what it is for; what it is made of and where it is used, or
 * a crossing's two ends; and, for a crossing, how to try it.
 */
function PieceWords({
  piece,
  onGo,
  tryIt,
}: {
  piece: PieceName
  onGo: Go
  tryIt: string | undefined
}) {
  const entry = pieceNamed(piece)
  const ways =
    'ends' in entry
      ? [
          { label: m.design_system_chat_end(), names: entry.ends.chat },
          { label: m.design_system_canvas_end(), names: entry.ends.canvas },
        ]
      : [
          { label: m.design_system_made_of(), names: entry.madeOf },
          { label: m.design_system_used_in(), names: usedIn(piece) },
        ]
  return (
    <div className="grid gap-3 motion-safe:animate-rise">
      <Message voice="agent" words={[entry.note()]} />
      {tryIt !== undefined && <Message voice="agent" words={[tryIt]} continued />}
      <dl className="grid gap-1.5 pl-[1.625rem]">
        {ways
          .filter(({ names }) => names.length > 0)
          .map(({ label, names }) => (
            <div key={label} className="flex flex-wrap items-baseline gap-x-1 gap-y-1">
              <dt className="pr-1 text-[0.75rem] text-faint">{label}</dt>
              {names.filter(isPiece).map((name) => (
                <dd key={name}>
                  <PieceWay name={name} shown={false} onGo={onGo} />
                </dd>
              ))}
            </div>
          ))}
      </dl>
    </div>
  )
}

/**
 * The stage the canvas gives what a slide shows of the design system, a piece's states or the
 * tokens: above them, a word of where it belongs and its name, on the ground, scrolled on its own.
 */
export function Stage(props: { kicker: string; title: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <div className="grid content-start gap-10 px-6 pt-24 pb-16 @wide:px-14">
        <header className="grid gap-1 motion-safe:animate-rise">
          <p className="font-agent text-[0.6875rem] text-faint">{props.kicker}</p>
          <h2 className="font-mono text-[1.75rem] font-light">{props.title}</h2>
        </header>
        {props.children}
      </div>
    </div>
  )
}
