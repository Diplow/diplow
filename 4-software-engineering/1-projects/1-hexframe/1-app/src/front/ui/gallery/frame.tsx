// The frame of /design-system: a section per tier, shown once a piece fills it, a section per piece,
// with what it is for, what it is made of and where it is used, as links within the page, then one
// labelled specimen per state; and the clock a timed specimen plays by.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

import { m } from '#/paraglide/messages'

import { anchorOf, filled, pieceNamed, usedIn, type PieceName, type Tier } from './pieces'

const tierTitles: Record<Tier, () => string> = {
  crossings: m.design_system_tier_crossings,
  chat: m.design_system_tier_chat,
  canvas: m.design_system_tier_canvas,
  layouts: m.design_system_tier_layouts,
  atoms: m.design_system_tier_atoms,
  seams: m.design_system_tier_seams,
}

const tierNotes: Record<Tier, () => string> = {
  crossings: m.design_system_tier_crossings_note,
  chat: m.design_system_tier_chat_note,
  canvas: m.design_system_tier_canvas_note,
  layouts: m.design_system_tier_layouts_note,
  atoms: m.design_system_tier_atoms_note,
  seams: m.design_system_tier_seams_note,
}

/** A tier's title, for the page's contents. */
export const tierTitle = (tier: Tier) => tierTitles[tier]()

/** A tier's anchor on the page. */
export const tierAnchor = (tier: Tier) => `tier-${tier}`

/** The tier a section is drawn under, which its pieces check against the catalogue's. */
const TierContext = createContext<Tier | undefined>(undefined)

/** A tier's section: its title, what it holds, then its pieces; nothing while no piece fills it. */
export function GalleryTier({ tier, children }: { tier: Tier; children?: ReactNode }) {
  if (!filled(tier)) return null
  return (
    <TierContext value={tier}>
      <section id={tierAnchor(tier)} className="grid scroll-mt-6 grid-cols-[minmax(0,1fr)] gap-8">
        <header className="grid gap-2 border-t border-input pt-8">
          <h2 className="text-3xl font-light">{tierTitles[tier]()}</h2>
          <p className="max-w-prose text-muted-foreground">{tierNotes[tier]()}</p>
        </header>
        {children}
      </section>
    </TierContext>
  )
}

/**
 * A piece's section: its name, what it is for, what it is made of, or a crossing's two ends, and where
 * it is used, then its states.
 */
export function GallerySection({ name, children }: { name: PieceName; children: ReactNode }) {
  const piece = pieceNamed(name)
  const drawnUnder = useContext(TierContext)
  // The catalogue says where a piece belongs; a page that draws it elsewhere is a bug, shown at once.
  if (drawnUnder !== piece.tier) {
    throw new Error(`${name} belongs to the ${piece.tier}, not to ${drawnUnder ?? 'no tier'}`)
  }
  return (
    <section
      id={anchorOf(name)}
      className="grid scroll-mt-6 grid-cols-[minmax(0,1fr)] gap-4 border-t pt-6"
    >
      <div className="grid gap-2">
        <h3 className="font-mono text-lg font-semibold">{name}</h3>
        <p className="max-w-prose text-sm text-muted-foreground">{piece.note()}</p>
        {'ends' in piece ? (
          <>
            <PieceLinks label={m.design_system_chat_end()} names={piece.ends.chat} />
            <PieceLinks label={m.design_system_canvas_end()} names={piece.ends.canvas} />
          </>
        ) : (
          <PieceLinks label={m.design_system_made_of()} names={piece.madeOf} />
        )}
        <PieceLinks label={m.design_system_used_in()} names={usedIn(name)} />
      </div>
      <div className="flex flex-wrap items-start gap-8">{children}</div>
    </section>
  )
}

function PieceLinks({ label, names }: { label: string; names: readonly string[] }) {
  if (names.length === 0) return null
  return (
    <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
      <span className="text-faint">{label}</span>
      {names.map((name) => (
        <a
          key={name}
          href={`#${anchorOf(name)}`}
          className="font-mono text-xs underline decoration-input underline-offset-4 hover:decoration-foreground"
        >
          {name}
        </a>
      ))}
    </p>
  )
}

/** A row's heading inside a piece's section, the full width, and what the row shows. */
export function GalleryGroup({ title, note }: { title: string; note: string }) {
  return (
    <div className="grid basis-full gap-1 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <h4 className="font-mono text-xs text-faint">{title}</h4>
      <p className="max-w-prose text-sm text-muted-foreground">{note}</p>
    </div>
  )
}

export function GalleryState({ label, children }: { label: string; children: ReactNode }) {
  return (
    <figure className="grid max-w-full min-w-0 grid-cols-[minmax(0,1fr)] gap-2 [&>*]:max-w-full">
      <figcaption className="text-xs text-muted-foreground">{label}</figcaption>
      {children}
    </figure>
  )
}

/** The conversation's column a chat specimen stands in, or, `phone`, a phone's width. */
export function GalleryColumn({
  phone = false,
  children,
}: {
  phone?: boolean
  children: ReactNode
}) {
  return (
    <div
      className={
        phone ? 'grid w-[23.4375rem] max-w-full gap-4' : 'grid w-[37.5rem] max-w-full gap-4'
      }
    >
      {children}
    </div>
  )
}

/**
 * The step a specimen's play has reached, each `steps[i]` ms after it started, started again at
 * every `turn`: a tile's states played one after another, a crossing's Turn.
 */
export function useSteps(steps: readonly number[], turn: number): number {
  const [step, setStep] = useState(0)
  useEffect(() => {
    setStep(0)
    const timers = steps.slice(1).map((at, index) =>
      setTimeout(() => {
        setStep(index + 1)
      }, at),
    )
    return () => {
      timers.forEach(clearTimeout)
    }
  }, [steps, turn])
  return step
}
