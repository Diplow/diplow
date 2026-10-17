// The frame of /design-system's pieces, which every folder's gallery draws in: each tier tells its
// pieces the tier they are drawn under, and a piece's section draws its specimens, one labelled per
// state, while it is the piece the deck shows (`deck/`), whose words, what it is for, what it is made
// of and where it is used, the chat tells; and the clock a timed specimen plays by.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

import { m } from '#/paraglide/messages'

import { pieceNamed, type PieceName, type Tier } from './pieces'

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

/** A tier's title. */
export const tierTitle = (tier: Tier) => tierTitles[tier]()

/** What a tier holds, in a sentence. */
export const tierNote = (tier: Tier) => tierNotes[tier]()

/** The tier a section is drawn under, which its pieces check against the catalogue's. */
const TierContext = createContext<Tier | undefined>(undefined)

/** The piece the deck shows, whose specimens alone are drawn. */
const ShownContext = createContext<PieceName | undefined>(undefined)

/** A tier's galleries, which tells their pieces the tier they are drawn under. */
export function GalleryTier({ tier, children }: { tier: Tier; children?: ReactNode }) {
  return <TierContext value={tier}>{children}</TierContext>
}

/** The galleries inside, of which the specimens of `piece` alone are drawn. */
export function ShowingPiece({ piece, children }: { piece: PieceName; children?: ReactNode }) {
  return <ShownContext value={piece}>{children}</ShownContext>
}

/**
 * A piece's section: its states, drawn while it is the piece shown; the chat tells its words. It throws
 * when drawn under another tier than the catalogue's.
 */
export function GallerySection({ name, children }: { name: PieceName; children: ReactNode }) {
  const piece = pieceNamed(name)
  const drawnUnder = useContext(TierContext)
  const shown = useContext(ShownContext)
  // The catalogue says where a piece belongs; a page that draws it elsewhere is a bug, shown at once.
  if (drawnUnder !== piece.tier) {
    throw new Error(`${name} belongs to the ${piece.tier}, not to ${drawnUnder ?? 'no tier'}`)
  }
  if (shown !== name) return null
  return (
    <section aria-label={name} className="flex flex-wrap items-start gap-x-10 gap-y-8">
      {children}
    </section>
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
 * every `turn`: a tile's states played one after another, a crossing's Turn. A step is its play's:
 * one an earlier play reached is no step of the next, which starts at its first, drawn at once.
 */
export function useSteps(steps: readonly number[], turn: number): number {
  const [reached, setReached] = useState({ turn, step: 0 })
  useEffect(() => {
    const timers = steps.slice(1).map((at, index) =>
      setTimeout(() => {
        setReached({ turn, step: index + 1 })
      }, at),
    )
    return () => {
      timers.forEach(clearTimeout)
    }
  }, [steps, turn])
  return reached.turn === turn ? reached.step : 0
}
