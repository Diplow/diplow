// A System as an actor may see it, from its star: the Tiles they may read, flat, each with the rights
// they have on it; the star itself always, as its card, its Title and Preview, which anyone sees, when
// they may not read it; and a Tile they may read below one they may not, placed under the star, the
// gap marked, so a reader draws "…" where the hidden Tiles stand. Pure: what Mapping's `system`
// answers, and what the client draws and offers by.
import type { FoundTile, PlacedReference, PlacedTile, System } from '../system'
import { type Actor, owns, Right, rightsOn, type Sharing } from './rights'

/**
 * A System as an actor may see it: flat, as Mapping holds it, with only what they may read; its star
 * as its card when they may not read it; the actor's rights on each Tile it holds, by id, its star's
 * included, which the client offers its actions by; and the Tiles placed under the star because the
 * actor may not read the Tile they stand under, by id, each a gap a reader draws as "…". Its owner
 * sees it whole, every right on every Tile, and no gap.
 */
export interface Seen extends System {
  readonly rights: Readonly<Record<string, ReadonlyArray<Right>>>
  readonly gaps: ReadonlyArray<string>
}

/**
 * A star as anyone sees it, its card: its Title and Preview, its Body empty, nothing it keeps from
 * its files, so the card says no more than a Handle shows.
 */
export const cardOf = ({ id, title, preview, version }: FoundTile): FoundTile => ({
  _tag: 'Tile',
  id,
  title,
  preview,
  body: '',
  version,
})

/** What stands below the star, as the actor sees it: a Tile, a Reference, or nothing. */
type Shown = PlacedTile | PlacedReference | undefined

/**
 * What the actor sees of one Tile or Reference below the star: nothing when they may not read it;
 * else it where it stands, under a Tile they see; else, a Tile under one they may not read, placed
 * under the star, a gap; a Reference there means nothing without the Tile holding it, and is left out.
 */
function shownOf(
  held: PlacedTile | PlacedReference,
  { star, reads }: { star: string; reads: (id: string) => boolean },
): { shown: Shown; gap: boolean } {
  if (!reads(held.id)) return { shown: undefined, gap: false }
  if (held.parent === star || reads(held.parent)) return { shown: held, gap: false }
  if (held._tag === 'Reference') return { shown: undefined, gap: false }
  return { shown: { ...held, parent: star }, gap: true }
}

/**
 * The System as this actor may see it, from the Grants its Tiles carry (`sharing`): whole for its
 * owner, every right on every Tile; for anyone else, only the Tiles and References they may read,
 * the star as its card unless they may read it, and a Tile below one they may not read placed under
 * the star, the gap marked.
 */
export function seenBy(actor: Actor, system: System, sharing: Sharing): Seen {
  const star = system.root.id
  const tilesOf = (held: System['tiles']) =>
    Object.values(held).flatMap((placed) => (placed._tag === 'Tile' ? [placed.id] : []))
  if (owns(actor, sharing.owner)) {
    const every = [star, ...tilesOf(system.tiles)].map((id) => [id, Right.literals] as const)
    return { ...system, rights: Object.fromEntries(every), gaps: [] }
  }
  const reads = (id: string) => rightsOn(actor, sharing, id).has('read')
  const tiles: Record<string, PlacedTile | PlacedReference> = {}
  const gaps: Array<string> = []
  for (const held of Object.values(system.tiles)) {
    const { shown, gap } = shownOf(held, { star, reads })
    if (shown !== undefined) tiles[shown.id] = shown
    if (gap) gaps.push(held.id)
  }
  const rights = [star, ...tilesOf(tiles)].map(
    (id) => [id, [...rightsOn(actor, sharing, id)]] as const,
  )
  return {
    ...system,
    root: reads(star) ? system.root : cardOf(system.root),
    tiles,
    rights: Object.fromEntries(rights),
    gaps,
  }
}
