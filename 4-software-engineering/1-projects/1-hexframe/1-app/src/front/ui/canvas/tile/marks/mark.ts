// Who touches a tile, as the canvas shows it (HEX-108's proposal, from components.html's #marks): you
// in your amber, where the chat points; the agent in its violet, reading a tile, working in it,
// changing it or proposing to; a Key from outside, hollow. What happened while you looked away stays
// as a dot until you open the tile. Each mark is a light on the tile, never a box, and what lasts of it
// a screen reader hears from the tile, as its hover card says it. The agent telling of its title or
// its preview lights that part of its words (HEX-120). Pure: the tile draws them
// (`Marks.tsx`), the caller says which tile carries which.
import { m } from '#/paraglide/messages'

import type { CardNote } from '../../../layouts/HoverCard'

/** Who acts on a tile: you, the agent, or a Key from outside. */
export type By = 'human' | 'agent' | 'key'

/** What an open Proposal would do to a tile already there; a tile it creates is a ghost of its own. */
type Proposed = 'edit' | 'move' | 'delete'

/** What the canvas shows of who touches a tile. */
export interface TileMark {
  /**
   * The chat points at it, a row of its `@` list or a tile named, hovered: lit, your amber held behind
   * it. `way`: what the chat points at stands below it, off the canvas, and this is the way to it.
   */
  pointed?: 'tile' | 'way'
  /** A light rising over it once, in the colour of who touched it; another `key` rises again. */
  glint?: { by: By; key: string | number }
  /** The agent's Turn works here: its light runs round the rim while the Turn lasts. */
  working?: boolean
  /** Changed while you looked away, by the agent or a Key: a dot, until you open it. */
  unseen?: Exclude<By, 'human'>
  /** What an open Proposal would do to it: its rim dashed in violet, since it isn't done yet. */
  proposed?: Proposed
  /**
   * The part of its words the agent tells of, as the chat says it: its title or its preview, lit in
   * the agent's violet round the words, which keep their contrast; its body, which the chat shows,
   * lighting nothing here (HEX-120).
   */
  told?: 'title' | 'preview' | 'body'
}

const unseenSaid: Record<Exclude<By, 'human'>, () => string> = {
  agent: m.tile_mark_unseen_agent,
  key: m.tile_mark_unseen_key,
}

const proposedSaid: Record<Proposed, () => string> = {
  edit: m.tile_mark_proposed_edit,
  move: m.tile_mark_proposed_move,
  delete: m.tile_mark_proposed_delete,
}

/**
 * What lasts of a mark, in words, for its hover card's note, in the colour of who it tells of, and a
 * screen reader: the agent working here, then what changed it or what is proposed. A light that
 * passes, the chat pointing, a glint or a part told, says nothing: the chat already says it.
 */
export function markNote(mark: TileMark | undefined): CardNote | undefined {
  if (mark === undefined) return undefined
  const lasting =
    (mark.unseen === undefined ? undefined : unseenSaid[mark.unseen]()) ??
    (mark.proposed === undefined ? undefined : proposedSaid[mark.proposed]())
  const text = [mark.working === true ? m.tile_mark_working() : undefined, lasting]
    .filter((said) => said !== undefined)
    .join(', ')
  if (text === '') return undefined
  // A Key's change is its own, hollow: everything else here is the agent's.
  return mark.unseen === 'key' && mark.working !== true ? { text } : { text, tone: 'agent' }
}

/**
 * Where the canvas shows the tile the chat points at: on its own hex where it is drawn; otherwise on
 * the nearest of its ancestors that is, the way to it; nowhere when none is. `path` runs from the
 * System's root down to the tile, both included (`pathTo`); one the System doesn't hold yet, a draft
 * or a ghost, has none.
 */
export function wayTo(
  pointed: string,
  path: readonly { id: string }[],
  drawn: (id: string) => boolean,
): { id: string; way: boolean } | undefined {
  if (drawn(pointed)) return { id: pointed, way: false }
  const ancestor = path
    .slice(0, -1)
    .reverse()
    .find(({ id }) => drawn(id))
  return ancestor === undefined ? undefined : { id: ancestor.id, way: true }
}
