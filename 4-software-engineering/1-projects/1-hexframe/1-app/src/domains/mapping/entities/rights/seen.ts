// A System as an actor may see it, from its star: the Tiles they may read, flat, each with the rights
// they have on it; the star itself always, as its card, its Title and Preview, which anyone sees, when
// they may not read it; a Tile they may read below one they may not, hung from the star across a gap,
// so a reader draws "…" where the hidden Tiles stand; and each Reference they may read, the Tile it
// points at resolved for them, of this System or pinned from another, or unavailable. Pure: what
// Mapping's `system` answers, and what the client draws and offers by.
import { Struct } from 'effect'

import {
  type Depth,
  type Field,
  foundIn,
  type FoundTile,
  isShippedId,
  type Pinned,
  type PinnedTiles,
  type PlacedReference,
  type PlacedTile,
  type System,
  type SystemTile,
  systemOf,
  tileAt,
} from '../system'
import type { FieldsAsked } from '../rows'
import { type Actor, owns, type Right, rightsOn, type Sharing } from './rights'

/**
 * A System as an actor may see it: flat, as Mapping holds it, with only what they may read, each
 * Tile and Reference where it stands under a Tile they see; its star as its card when they may not
 * read it; the actor's rights on each Tile it holds, by id, its star's and its gaps' included, which
 * the client offers its actions by; and its gaps, by id, each a Tile they may read below a Tile they
 * may not, hung from the star with no place of its own, since its place is under a Tile kept from
 * them: a reader draws "…" between it and the star. What stands below a gap stands in `tiles`, under
 * it. The System's Version and the card's are their owner's alone: anyone else is shown, in the
 * System's, how what they see stands (`sightVersion`), since a count of changes would tell of the
 * Tiles kept from them. Its owner sees it whole, every right on every Tile but a shipped one, which
 * they read alone, and no gap.
 */
export interface Seen extends System {
  readonly rights: Readonly<Record<string, ReadonlyArray<Right>>>
  readonly gaps: Readonly<Record<string, FoundTile>>
  /**
   * The Tiles of other Systems its References point at that the actor may read there, by id, each
   * with the Title of the star holding it: what a pin shows them, read on every read, so one they
   * lose *read* on shows unavailable from the next (`systemOf`'s `pinned`).
   */
  readonly pinned: PinnedTiles
  /**
   * Whether the actor stands for the System's owner, so holds every right on it and what its owner
   * alone does, sharing its Tiles among it: an Account on its own, and on the Systems whose owners
   * the API layer says it stands for (`Actor.owners`).
   */
  readonly asOwner: boolean
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
 * A Reference, or its row, as a reader is shown it when they are shown nothing of the Tile it points
 * at: unavailable, as one whose Tile was deleted, pointing at no id (`''`), so neither whether that
 * Tile exists nor its id is told, and someone who could never read it sees what someone who lost
 * *read* on it sees.
 */
/** The target an unavailable Reference is shown with: no id (`unavailable`). */
export const noTarget = ''

const unavailable = <R extends { readonly target: string | null }>(reference: R): R => ({
  ...reference,
  target: noTarget,
})

/**
 * A Reference, or its row, as a reader is shown it: as it stands while they are shown the Tile it
 * points at (`shown`), else `unavailable`, whoever they are, the owner of the System holding it
 * included, so a pin someone else made never tells them an id. The one rule of it, which `seenBy`
 * and the service's reads from one Tile share; a row that is a Tile passes as it is.
 */
export const pointing = <R extends { readonly target: string | null }>(
  reference: R,
  shown: (target: string) => boolean,
): R => (reference.target === null || shown(reference.target) ? reference : unavailable(reference))

/**
 * A System with each of its References as a reader is shown it (`pointing`), by whether they are
 * shown the Tile it points at: what a whole read, an export and a Turn's files write, so none of them
 * tells an id the reader is not shown.
 */
export const referencesShown = (system: System, shown: (target: string) => boolean): System => ({
  ...system,
  tiles: Object.fromEntries(
    Object.entries(system.tiles).map(([id, held]) => [
      id,
      held._tag === 'Reference' ? pointing(held, shown) : held,
    ]),
  ),
})

/**
 * Whether a reader is shown the Tile a Reference points at, the one rule of it: a Tile its System
 * holds that `here` shows them, or one of another System among those they may read (`pinned`); a
 * deleted one is neither. `here` is told only of ids it holds.
 */
export const pointsAt =
  (here: (target: string) => boolean, pinned: PinnedTiles) =>
  (target: string): boolean =>
    here(target) || Object.hasOwn(pinned, target)

/** What a reader is shown of a System's own Tiles, as `pointsAt`'s `here` asks it, by `sight`. */
const pointsAtShown = (system: System, sight: Sight, pinned: PinnedTiles) =>
  pointsAt((target) => tileAt(system, target) !== undefined && sight.shows(target), pinned)

/** How the actor sees one Tile or Reference below the star. */
type Shown =
  | { readonly as: 'hidden' }
  | { readonly as: 'placed'; readonly held: PlacedTile | PlacedReference }
  | { readonly as: 'gap'; readonly tile: FoundTile }

/**
 * How the actor sees one Tile or Reference below the star: hidden when they may not read it; else
 * where it stands, under a Tile they see, a Reference unavailable when it points at no Tile they are
 * shown, here or among the Tiles of other Systems they may read (`pinned`); else, a Tile under one
 * they may not read, a gap, with no place; a Reference there means nothing without the Tile holding
 * it, and is hidden.
 */
function shownOf(
  held: PlacedTile | PlacedReference,
  { system, sight, pinned }: { system: System; sight: Sight; pinned: PinnedTiles },
): Shown {
  if (!sight.reads(held.id)) return { as: 'hidden' }
  if (sight.shows(held.parent)) {
    if (held._tag === 'Tile') return { as: 'placed', held }
    return { as: 'placed', held: pointing(held, pointsAtShown(system, sight, pinned)) }
  }
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
export function sightVersion({ root, tiles, gaps, rights, pinned }: Omit<Seen, 'version'>): number {
  const lines = [
    `star ${root.id} ${String(root.version)} ${JSON.stringify([root.title, root.preview])}`,
    ...Object.values(tiles).map((held) =>
      held._tag === 'Tile'
        ? `tile ${held.id} ${String(held.version)} ${held.parent} ${JSON.stringify(held.slot)}`
        : `reference ${held.id} ${held.target} ${held.parent} ${String(held.slot)}`,
    ),
    ...Object.values(gaps).map((gap) => `gap ${gap.id} ${String(gap.version)}`),
    ...Object.entries(rights).map(([id, held]) => `rights ${id} ${held.join('+')}`),
    // A pin of a Tile hexframe ships says no words here: they change with a deploy alone and read
    // in the page's language, which the poll does not send, so it never reads the System again.
    ...Object.values(pinned).map((pin) =>
      isShippedId(pin.id)
        ? `pinned ${pin.id}`
        : `pinned ${pin.id} ${JSON.stringify([pin.title, pin.preview, pin.starTitle])}`,
    ),
  ].sort()
  let hash = 0x811c9dc5
  for (const unit of lines.join('\n')) {
    hash = Math.imul(hash ^ (unit.codePointAt(0) ?? 0), 0x01000193)
  }
  return hash >>> 0
}

/** The pins among these the References shown point at, and no other. */
function pinsOf(
  tiles: Readonly<Record<string, PlacedTile | PlacedReference>>,
  pinned: PinnedTiles,
) {
  const kept: Record<string, Pinned> = {}
  for (const held of Object.values(tiles)) {
    const pin =
      held._tag === 'Reference' && Object.hasOwn(pinned, held.target)
        ? pinned[held.target]
        : undefined
    if (pin !== undefined) kept[pin.id] = pin
  }
  return kept
}

/**
 * The System as this actor may see it, from the Grants its Tiles carry (`sharing`), and the Tiles of
 * other Systems its References point at that they may read there (`pinned`): whole for its owner,
 * every right on every Tile; for anyone else, only the Tiles and References they may read, a
 * Reference to a Tile they are shown neither here nor among `pinned` unavailable, the star as its
 * card unless they may read it, a Tile below one they may not read a gap, and, for the System's
 * Version, how what they see stands (`sightVersion`), no count of the System's changes.
 */
export function seenBy(
  actor: Actor,
  system: System,
  sharing: Sharing,
  pinned: PinnedTiles = {},
): Seen {
  const star = system.root.id
  const sight = sightOf(actor, sharing, star)
  if (owns(actor, sharing.owner)) {
    // Every right on every Tile, but *read* alone on a Tile hexframe ships (`rightsOn`).
    const every = [star, ...tileIds(Object.values(system.tiles))].map(
      (id) => [id, [...rightsOn(actor, sharing, id)]] as const,
    )
    const { tiles } = referencesShown(system, pointsAtShown(system, sight, pinned))
    return {
      ...system,
      tiles,
      rights: Object.fromEntries(every),
      gaps: {},
      pinned: pinsOf(tiles, pinned),
      asOwner: true,
    }
  }
  const tiles: Record<string, PlacedTile | PlacedReference> = {}
  const gaps: Record<string, FoundTile> = {}
  for (const held of Object.values(system.tiles)) {
    const shown = shownOf(held, { system, sight, pinned })
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
    pinned: pinsOf(tiles, pinned),
    asOwner: false,
  }
  return { ...shown, version: sightVersion(shown) }
}

/**
 * What a reader is shown of a System across its gaps, as trees: each Tile across a gap as a Root of
 * its own, with what they may read below it, its place above being kept from them, in the order of
 * their Titles, then their ids, so two readers order them alike. What the canvas hangs from the star,
 * the composer offers and a Turn's files write each in a folder of its own.
 */
export function acrossGaps(
  system: System,
  gaps: Seen['gaps'],
  pinned: PinnedTiles = {},
): ReadonlyArray<SystemTile> {
  return Object.values(gaps)
    .toSorted((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id))
    .map((gap) => systemOf({ ...system, root: gap }, pinned))
}

/**
 * What a read from a Tile of a System as a reader is shown it finds: from a Tile across a gap as from
 * its own Root, its place above being kept from them, so its parent is none.
 */
export function foundInSeen<O extends Field, F extends Field>(
  seen: Seen,
  { id, depth, fields }: { id?: string | undefined; depth: Depth; fields: FieldsAsked<O, F> },
) {
  const gap = id === undefined || !Object.hasOwn(seen.gaps, id) ? undefined : seen.gaps[id]
  return foundIn(gap === undefined ? seen : { ...seen, root: gap }, { id, depth, fields })
}
