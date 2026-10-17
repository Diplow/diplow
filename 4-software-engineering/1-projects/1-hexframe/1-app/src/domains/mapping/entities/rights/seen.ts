// A System as an actor may see it, from its star: the Tiles they may read, flat, each with the rights
// they have on it; the star itself always, as its card, its Title and Preview, which anyone sees, when
// they may not read it; and a Tile they may read below one they may not, hung from the star across a
// gap, so a reader draws "…" where the hidden Tiles stand. Pure: what Mapping's `system` answers, and
// what the client draws and offers by.
import { Struct } from 'effect'

import type { FoundTile, PlacedReference, PlacedTile, System } from '../system'
import { type Actor, owns, Right, rightsOn, type Sharing } from './rights'

/**
 * A System as an actor may see it: flat, as Mapping holds it, with only what they may read, each
 * Tile and Reference where it stands under a Tile they see; its star as its card when they may not
 * read it; the actor's rights on each Tile it holds, by id, its star's and its gaps' included, which
 * the client offers its actions by; and its gaps, by id, each a Tile they may read below a Tile they
 * may not, hung from the star with no place of its own, since its place is under a Tile kept from
 * them: a reader draws "…" between it and the star. What stands below a gap stands in `tiles`, under
 * it. The System's Version and the card's are their owner's alone: anyone else is shown none, since
 * a count of changes would tell of the Tiles kept from them. Its owner sees it whole, every right on
 * every Tile, and no gap.
 */
export interface Seen extends System {
  readonly rights: Readonly<Record<string, ReadonlyArray<Right>>>
  readonly gaps: Readonly<Record<string, FoundTile>>
}

/**
 * What anyone is shown of a star, its card, on a Tile or on a row a read finds: its Title and
 * Preview, its Body empty, and no count of what changed it, its Version the first. The one rule of a
 * card.
 */
export const carded = <C extends object>(found: C): C => ({
  ...found,
  ...('body' in found && { body: '' }),
  ...('version' in found && { version: 1 }),
})

/**
 * A star as anyone sees it, its card (`carded`), nothing it keeps from its files, so the card says no
 * more than a Handle shows.
 */
export const cardOf = ({ id, title, preview, body, version }: FoundTile): FoundTile =>
  carded({ _tag: 'Tile', id, title, preview, body, version })

/**
 * What an actor is shown of a System, by id, from what they may read: that, and the star, whose card
 * anyone sees.
 */
export const seeing =
  (star: string, reads: (id: string) => boolean) =>
  (id: string): boolean =>
    id === star || reads(id)

/** How the actor sees one Tile or Reference below the star. */
type Shown =
  | { readonly as: 'hidden' }
  | { readonly as: 'placed'; readonly held: PlacedTile | PlacedReference }
  | { readonly as: 'gap'; readonly tile: FoundTile }

/**
 * How the actor sees one Tile or Reference below the star: hidden when they may not read it, nor, a
 * Reference, the Tile it points at, which an id would tell of; else where it stands, under a Tile
 * they see; else, a Tile under one they may not read, a gap, with no place; a Reference there means
 * nothing without the Tile holding it, and is hidden.
 */
function shownOf(
  held: PlacedTile | PlacedReference,
  { reads, shows }: { reads: (id: string) => boolean; shows: (id: string) => boolean },
): Shown {
  if (!reads(held.id)) return { as: 'hidden' }
  if (held._tag === 'Reference' && !shows(held.target)) return { as: 'hidden' }
  if (shows(held.parent)) return { as: 'placed', held }
  if (held._tag === 'Reference') return { as: 'hidden' }
  return { as: 'gap', tile: Struct.omit(held, ['parent', 'slot']) }
}

/** The ids of the Tiles among these, a Reference's left out. */
const tileIds = (held: ReadonlyArray<PlacedTile | PlacedReference | FoundTile>) =>
  held.flatMap((placed) => (placed._tag === 'Tile' ? [placed.id] : []))

/**
 * The System as this actor may see it, from the Grants its Tiles carry (`sharing`): whole for its
 * owner, every right on every Tile; for anyone else, only the Tiles and References they may read,
 * a Reference to a Tile they may not read left out, the star as its card unless they may read it, a
 * Tile below one they may not read a gap, and no count of the System's changes.
 */
export function seenBy(actor: Actor, system: System, sharing: Sharing): Seen {
  const star = system.root.id
  if (owns(actor, sharing.owner)) {
    const every = [star, ...tileIds(Object.values(system.tiles))].map(
      (id) => [id, Right.literals] as const,
    )
    return { ...system, rights: Object.fromEntries(every), gaps: {} }
  }
  const reads = (id: string) => rightsOn(actor, sharing, id).has('read')
  const shows = seeing(star, reads)
  const tiles: Record<string, PlacedTile | PlacedReference> = {}
  const gaps: Record<string, FoundTile> = {}
  for (const held of Object.values(system.tiles)) {
    const shown = shownOf(held, { reads, shows })
    if (shown.as === 'placed') tiles[held.id] = shown.held
    if (shown.as === 'gap') gaps[held.id] = shown.tile
  }
  const seen = [star, ...tileIds([...Object.values(tiles), ...Object.values(gaps)])]
  const rights = seen.map((id) => [id, [...rightsOn(actor, sharing, id)]] as const)
  return {
    ...system,
    root: reads(star) ? system.root : cardOf(system.root),
    tiles,
    version: 0,
    rights: Object.fromEntries(rights),
    gaps,
  }
}
