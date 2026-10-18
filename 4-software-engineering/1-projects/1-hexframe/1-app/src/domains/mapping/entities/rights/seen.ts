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
 * it. The System's Version and the card's are their owner's alone: anyone else is shown, in the
 * System's, how what they see stands (`sightVersion`), since a count of changes would tell of the
 * Tiles kept from them. Its owner sees it whole, every right on every Tile, and no gap.
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

/** What an actor may read of a System, by id, and what they are shown. */
export interface Sight {
  readonly reads: (id: string) => boolean
  readonly shows: (id: string) => boolean
}

/**
 * What an actor may read of a System, from the Grants its Tiles carry, every Tile for its owner; and
 * what they are shown (`shows`): what they may read, and the star, whose card anyone sees. The one
 * reading of it, which the System's read (`seenBy`) and every read from one Tile share.
 */
export function sightOf(actor: Actor, sharing: Sharing, star: string): Sight {
  if (owns(actor, sharing.owner)) return { reads: () => true, shows: () => true }
  const reads = (id: string) => rightsOn(actor, sharing, id).has('read')
  return { reads, shows: (id) => id === star || reads(id) }
}

/**
 * Whether a row an actor may come upon is shown them, where its parent is: when they may read it,
 * and, a Reference, the Tile it points at, or the star, since its id would tell of a Tile kept from
 * them otherwise.
 */
export const shownRow = (
  { id, target }: { readonly id: string; readonly target: string | null },
  { reads, shows }: Sight,
) => reads(id) && (target === null || shows(target))

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
function shownOf(held: PlacedTile | PlacedReference, sight: Sight): Shown {
  const target = held._tag === 'Reference' ? held.target : null
  if (!shownRow({ id: held.id, target }, sight)) return { as: 'hidden' }
  if (sight.shows(held.parent)) return { as: 'placed', held }
  if (held._tag === 'Reference') return { as: 'hidden' }
  return { as: 'gap', tile: Struct.omit(held, ['parent', 'slot']) }
}

/** The ids of the Tiles among these, a Reference's left out. */
const tileIds = (held: ReadonlyArray<PlacedTile | PlacedReference | FoundTile>) =>
  held.flatMap((placed) => (placed._tag === 'Tile' ? [placed.id] : []))

/**
 * How what a reader is shown of a System stands, as one number, for anyone but its owner: the star as
 * they see it, every Tile and Reference they see where it stands, each Tile at its Version, and their
 * rights on each, hashed (FNV-1a, 32 bits). It moves whenever any of it does, and never for what is
 * kept from them, which a count of the System's changes would tell of. No count: two of them only
 * ever say the same or another, which a visitor's poll compares to read the System again.
 */
export function sightVersion({ root, tiles, gaps, rights }: Omit<Seen, 'version'>): number {
  const lines = [
    `star ${root.id} ${String(root.version)} ${JSON.stringify([root.title, root.preview])}`,
    ...Object.values(tiles).map((held) =>
      held._tag === 'Tile'
        ? `tile ${held.id} ${String(held.version)} ${held.parent} ${JSON.stringify(held.slot)}`
        : `reference ${held.id} ${held.target} ${held.parent} ${String(held.slot)}`,
    ),
    ...Object.values(gaps).map((gap) => `gap ${gap.id} ${String(gap.version)}`),
    ...Object.entries(rights).map(([id, held]) => `rights ${id} ${held.join('+')}`),
  ].sort()
  let hash = 0x811c9dc5
  for (const unit of lines.join('\n')) {
    hash = Math.imul(hash ^ (unit.codePointAt(0) ?? 0), 0x01000193)
  }
  return hash >>> 0
}

/**
 * The System as this actor may see it, from the Grants its Tiles carry (`sharing`): whole for its
 * owner, every right on every Tile; for anyone else, only the Tiles and References they may read,
 * a Reference to a Tile they may not read left out, the star as its card unless they may read it, a
 * Tile below one they may not read a gap, and, for the System's Version, how what they see stands
 * (`sightVersion`), no count of the System's changes.
 */
export function seenBy(actor: Actor, system: System, sharing: Sharing): Seen {
  const star = system.root.id
  if (owns(actor, sharing.owner)) {
    const every = [star, ...tileIds(Object.values(system.tiles))].map(
      (id) => [id, Right.literals] as const,
    )
    return { ...system, rights: Object.fromEntries(every), gaps: {} }
  }
  const sight = sightOf(actor, sharing, star)
  const tiles: Record<string, PlacedTile | PlacedReference> = {}
  const gaps: Record<string, FoundTile> = {}
  for (const held of Object.values(system.tiles)) {
    const shown = shownOf(held, sight)
    if (shown.as === 'placed') tiles[held.id] = shown.held
    if (shown.as === 'gap') gaps[held.id] = shown.tile
  }
  const seen = [star, ...tileIds([...Object.values(tiles), ...Object.values(gaps)])]
  const rights = seen.map((id) => [id, [...rightsOn(actor, sharing, id)]] as const)
  const shown = {
    ...system,
    root: sight.reads(star) ? system.root : cardOf(system.root),
    tiles,
    rights: Object.fromEntries(rights),
    gaps,
  }
  return { ...shown, version: sightVersion(shown) }
}
