// What can be done to a tile, by its kind and where it stands (HEX-105's proposal): the verbs its menu
// offers, in groups by distance (going there, changing it, placing it, the agent, sharing it, then
// deleting it), what a click does and what a tap does, and the place its menu's header and its hover
// card name. Pure: the menu draws them, its caller says what each does.
import { m } from '#/paraglide/messages'

import type { Direction } from '../../geometry/geometry'
import type { TileLook } from '../Tile'

/**
 * The kinds a menu opens on: a ring too full is no tile, and has none; nor has a ghost, which is a
 * Proposal's, decided in the chat, nor a tile you are writing, which is the tile widget's until made.
 */
type MenuKind = Exclude<TileLook['kind'], 'list' | 'ghost' | 'writing'>

/** What a menu says of a tile, beyond its kind and its place. */
interface Words {
  title: string
  /** The tile it is in: the one the center backs out to, the frame one in the ring moves in. */
  parent?: string
  /** How many tiles are below it, which deleting it takes along. */
  below?: number
  /**
   * Whether it can turn into the other kind, a Branch into a Leaf or a Leaf into a Branch: Mapping's
   * `decide` says, which its caller asks.
   */
  turns?: boolean
  /** Whether a tile can be added inside it: Mapping's `decide` says, which its caller asks. */
  holds?: boolean
}

/**
 * What a menu acts on: a tile, by its kind and where it stands, at the center or in a Direction of
 * the ring, the root only ever at the center; or a free slot.
 */
export type Subject =
  | (Words & { kind: 'root' | 'untitled'; at: 'center' })
  | (Words & { kind: Exclude<MenuKind, 'root' | 'untitled'>; at: 'center' | Direction })
  | { kind: 'slot'; at: Direction; parent: string }

/** A line of a tile's menu; `add`, `move` and `copy` open a submenu. */
export type Verb =
  | 'back-out'
  | 'open'
  | 'go-in'
  | 'show-context'
  | 'edit'
  | 'make-leaf'
  | 'make-branch'
  | 'add'
  | 'move'
  | 'ask-agent'
  | 'copy'
  | 'share'
  | 'export'
  | 'members'
  | 'delete'
  | 'remove-reference'
  | 'new-tile'
  | 'import'

/** The verbs that open a submenu rather than act. */
type Opening = 'add' | 'move' | 'copy'

/** A verb that acts at once, with no submenu to pick from. */
export const actsAtOnce = (verb: Verb): verb is Exclude<Verb, Opening> =>
  verb !== 'add' && verb !== 'move' && verb !== 'copy'

/** What the menu hands its caller: a verb, one of what Copy holds, or a place picked in a frame. */
export type TileAct =
  | {
      verb: Exclude<Verb, Opening> | 'copy-link' | 'copy-title' | 'copy-mention' | 'move-elsewhere'
    }
  | { verb: 'add' | 'move' | 'swap'; at: Direction }

type Group = readonly (Verb | false | undefined)[]

/** The groups of a tile in the ring, by its kind. */
function ringGroups(
  kind: Exclude<MenuKind, 'root' | 'untitled'>,
  { turns = false, holds = false }: Pick<Words, 'turns' | 'holds'>,
): readonly Group[] {
  switch (kind) {
    case 'branch':
      return [
        ['open', 'go-in', 'show-context'],
        ['edit', turns && 'make-leaf'],
        [holds && 'add', 'move'],
        ['ask-agent'],
        ['copy', 'share', 'export'],
        ['delete'],
      ]
    case 'leaf':
      return [
        ['open', 'show-context'],
        ['edit', turns && 'make-branch'],
        [holds && 'add', 'move'],
        ['ask-agent'],
        ['copy', 'share', 'export'],
        ['delete'],
      ]
    case 'context':
      return [
        ['open'],
        ['edit'],
        [holds && 'add', 'move'],
        ['ask-agent'],
        ['copy', 'share', 'export'],
        ['delete'],
      ]
    case 'reference':
      return [['open'], ['ask-agent'], ['copy'], ['remove-reference']]
    case 'broken':
      return [['ask-agent'], ['remove-reference']]
    case 'draft':
      return [['open'], ['ask-agent']]
  }
}

/**
 * The center's: backing out to the tile it is in, its Context, and what can be done where you stand;
 * it neither moves nor goes, since it is where you are.
 */
function centerGroups(subject: Extract<Subject, { title: string }>): readonly Group[] {
  const { kind, holds = false } = subject
  const own = kind !== 'reference' && kind !== 'broken' && kind !== 'draft'
  return [
    [subject.parent !== undefined && 'back-out', kind !== 'draft' && 'show-context'],
    [own && 'edit'],
    [holds && 'add', kind === 'untitled' && 'import'],
    ['ask-agent'],
    [kind !== 'broken' && 'copy', own && 'share', own && 'export', kind === 'root' && 'members'],
  ]
}

/** The verbs a subject's menu offers, in its groups, an empty group left out. */
export function groupsOf(subject: Subject): Verb[][] {
  const groups =
    subject.kind === 'slot'
      ? [['new-tile', 'import'], ['ask-agent']]
      : subject.at === 'center'
        ? centerGroups(subject)
        : ringGroups(subject.kind, subject)
  return groups
    .map((group) => group.filter((verb): verb is Verb => typeof verb === 'string'))
    .filter((group) => group.length > 0)
}

/**
 * What a click on the subject does, or a tap under a finger. The center opens into its ring, or folds
 * back alone; in the ring, a Branch opens in place and the rest go in. A finger has no double click,
 * the pointer's way to go in: its tap goes in, and opening in place waits in the menu. A free slot
 * adds a tile; a Reference whose tile is gone, or a Leaf at the center, takes none.
 */
export function clickOf(
  subject: Subject,
  finger: boolean,
): 'new-tile' | 'open' | 'go-in' | undefined {
  if (subject.kind === 'slot') return 'new-tile'
  if (subject.at === 'center') {
    return subject.kind === 'leaf' || subject.kind === 'draft' ? undefined : 'open'
  }
  if (subject.kind === 'broken') return undefined
  return subject.kind === 'branch' && finger ? 'go-in' : 'open'
}

const directionNames: Record<Direction, () => string> = {
  1: m.direction_north_west,
  2: m.direction_north_east,
  3: m.direction_east,
  4: m.direction_south_east,
  5: m.direction_south_west,
  6: m.direction_west,
}

/** A Direction, in words: north-west, east… */
export const directionName = (direction: Direction) => directionNames[direction]()

/** A free slot's place, in a few words, which a screen reader hears beside its name: "free, east". */
export const slotPlace = (direction: Direction) =>
  m.tile_place_ring({ kind: m.tile_word_slot(), direction: directionName(direction) })

const kindWords: Record<MenuKind | 'slot', () => string> = {
  root: m.tile_word_root,
  untitled: m.tile_word_root,
  branch: m.tile_word_branch,
  leaf: m.tile_word_leaf,
  context: m.tile_word_context,
  reference: m.tile_word_reference,
  broken: m.tile_word_broken,
  draft: m.tile_word_draft,
  slot: m.tile_word_slot,
}

/**
 * Its kind and place, in a few words, which the menu's header and the hover card show under or above
 * its title: "branch, north-east in Software engineering", "root, the center".
 */
export function placeOf(subject: Subject): string {
  const kind = kindWords[subject.kind]()
  if (subject.at === 'center') {
    return subject.parent === undefined
      ? m.tile_place_center({ kind })
      : m.tile_place_center_in({ kind, parent: subject.parent })
  }
  const direction = directionName(subject.at)
  return subject.parent === undefined
    ? m.tile_place_ring({ kind, direction })
    : m.tile_place_ring_in({ kind, direction, parent: subject.parent })
}
