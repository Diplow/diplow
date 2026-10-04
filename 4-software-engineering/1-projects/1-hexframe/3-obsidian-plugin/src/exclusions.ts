// What the settings panel makes of a folder's exclusions: every candidate of each kind, whether
// the folder leaves it out and by which item, the count of each kind against six as the user ticks,
// and the folder's `exclusions.yaml` written back with what they changed, the rest of it kept. Pure,
// so reading and writing the file is tested without Obsidian; the panel and the view carry it out.
import {
  isExcluded,
  parseExclusions,
  patternOf,
} from '../../2-claude-mod/hooks/shape/exclusions.ts'
import {
  linesOf,
  sortEntries,
  type Entry,
  type MemberKind,
  type Ring,
  type Slot,
} from '../../2-claude-mod/hooks/shape/node.ts'

/** How many hexes a ring draws around its Tile. */
const six = 6

/**
 * Every candidate of a folder, by kind, in name order, before its `exclusions.yaml` leaves any out:
 * what the shape sorts into rings once the names every folder leaves out are gone.
 */
export function candidatesOf(entries: readonly Entry[]): Record<MemberKind, Slot[]> {
  const rings = sortEntries(entries, [])
  const slots = [rings.children, rings.branches, rings.leaves, rings.context].flatMap(slotsOf)
  const ofKind = (kind: MemberKind) =>
    slots.filter((slot) => slot.kind === kind).sort((a, b) => (a.name < b.name ? -1 : 1))
  return { branch: ofKind('branch'), leaf: ofKind('leaf'), context: ofKind('context') }
}

function slotsOf(ring: Ring<Slot> | undefined): Slot[] {
  if (ring === undefined) return []
  return ring.overflowing ? ring.candidates : Object.values(ring.members)
}

/**
 * Whether `items`, a folder's exclusions, leave `slot` out, and how: not at all, only by items that
 * name it (its name, a folder's with or without its trailing `/`), which ticking it again removes,
 * or by a glob the user wrote, which the panel keeps and names.
 */
export type Leaving = { by: 'none' } | { by: 'name' } | { by: 'glob'; glob: string }

export function leavingOf(slot: Slot, items: readonly string[]): Leaving {
  const isFolder = slot.kind !== 'leaf'
  const leaving = items.filter((item) => isExcluded(slot.name, isFolder, [item]))
  if (leaving.length === 0) return { by: 'none' }
  const glob = leaving.find((item) => !names(item, slot))
  return glob === undefined ? { by: 'name' } : { by: 'glob', glob }
}

/** Whether `item` names `slot` exactly, rather than matching it as a glob. */
function names(item: string, slot: Slot): boolean {
  return item === slot.name || item === patternOf(slot)
}

/**
 * `items` once the user ticked or unticked `slot`: shown, its pattern added, as a list writes it;
 * left out by name, every item naming it removed. One a glob leaves out stays as it is, since
 * removing the glob would bring back what else it matches.
 */
export function toggled(items: readonly string[], slot: Slot): string[] {
  const leaving = leavingOf(slot, items)
  if (leaving.by === 'none') return [...items, patternOf(slot)]
  if (leaving.by === 'glob') return [...items]
  return items.filter((item) => !names(item, slot))
}

/** The items written by hand that name none of `candidates`: globs, and names of nothing here. */
export function handWritten(
  items: readonly string[],
  candidates: Record<MemberKind, readonly Slot[]>,
): string[] {
  const all = [...candidates.branch, ...candidates.leaf, ...candidates.context]
  return items.filter((item) => !all.some((slot) => names(item, slot)))
}

/** How one kind stands against six: how many it shows, and whether its ring then overflows. */
export interface Count {
  shown: number
  overflowing: boolean
}

/**
 * Each kind's count once `items` leave names out, and the Children ring's when the Branches and the
 * Leaves, six or fewer in all, then draw together as Children, whose ring counts for both.
 */
export function countsOf(
  entries: readonly Entry[],
  items: readonly string[],
): Record<MemberKind, Count> & { children: Count | undefined } {
  const rings = sortEntries(entries, items)
  const all = candidatesOf(entries)
  const shown = (kind: MemberKind) =>
    all[kind].filter(({ name }) => !isExcluded(name, kind !== 'leaf', items)).length
  const overflows = (ring: Ring<unknown> | undefined) => ring?.overflowing === true
  const together = {
    shown: shown('branch') + shown('leaf'),
    overflowing: overflows(rings.children),
  }
  return {
    branch: { shown: shown('branch'), overflowing: overflows(rings.children ?? rings.branches) },
    leaf: { shown: shown('leaf'), overflowing: overflows(rings.children ?? rings.leaves) },
    context: { shown: shown('context'), overflowing: overflows(rings.context) },
    children: rings.children === undefined ? undefined : together,
  }
}

/** What the panel says of the Branches and the Leaves together, from the Children ring's count. */
export function togetherLine(children: Count | undefined): string {
  return children === undefined
    ? 'Branches and Leaves are more than six in all, so each kind draws in a ring of its own.'
    : `Branches and Leaves draw together as Children: ${countLine(children)}.`
}

/** What a count says beside its kind: how many of six, and why its ring shows as a list. */
export function countLine({ shown, overflowing }: Count): string {
  const count = `${String(shown)} of ${String(six)}`
  if (!overflowing) return count
  return shown > six
    ? `${count}, ${String(shown - six)} too many: they show as a list`
    : `${count}, names share a number: they show as a list`
}

/** What a save changes in a folder's exclusions: the items it adds and the ones it removes. */
export interface Change {
  add: readonly string[]
  remove: readonly string[]
}

/** The change from `before` to `after`, the items the panel started from and ended with. */
export function changeOf(before: readonly string[], after: readonly string[]): Change {
  return {
    add: after.filter((item) => !before.includes(item)),
    remove: before.filter((item) => !after.includes(item)),
  }
}

/** Whether `change` changes nothing. */
export function isEmpty({ add, remove }: Change): boolean {
  return add.length === 0 && remove.length === 0
}

/**
 * `text`, a folder's `exclusions.yaml` (undefined when it has none), with `change` made: each item
 * removed has its line dropped, each one added a line after the last item, in the list's own
 * indent. Everything else stays as written, comments, the globs written by hand and their order
 * included, and its line ending; a flow list becomes a block list, so its items take a line each.
 * A change of nothing gives `text` back as it is. A file that can't be parsed throws, so it is never
 * written over, and so does a change that wouldn't read back as made, such as a name holding a line
 * break, which the file can't hold.
 */
export function withChange(text: string | undefined, change: Change): string {
  const before = text ?? ''
  const items = parseExclusions(before)
  if (isEmpty(change)) return before
  const add = change.add.filter(
    (item, at) => !items.includes(item) && change.add.indexOf(item) === at,
  )
  const unwritable = add.find(breaksLines)
  if (unwritable !== undefined) {
    throw new Error(`${JSON.stringify(unwritable)} holds a line break or a control character`)
  }
  const { kept, indent, listEnds } = withRemoved(linesOf(before), change.remove)
  // A file with no key yet, empty or comments only, gets one at its end.
  let at = listEnds
  if (at === -1) {
    while (kept.length > 0 && kept[kept.length - 1] === '') kept.pop()
    at = kept.push('exclude:')
  }
  kept.splice(at, 0, ...add.map((item) => `${indent}- ${yamlOf(item)}`))
  const eol = before.includes('\r\n') ? '\r\n' : '\n'
  const written = `${kept.join(eol).replace(/(\r?\n)+$/, '')}${eol}`
  const wanted = [...items.filter((item) => !change.remove.includes(item)), ...add]
  if (JSON.stringify(parseExclusions(written)) !== JSON.stringify(wanted)) {
    throw new Error('the change would not read back as made')
  }
  return written
}

/**
 * `lines`, a parsed `exclusions.yaml`, with the lines of the items in `remove` dropped and a flow
 * list made a block list; the indent of its list items, and where the list ends, -1 when the file
 * has no key.
 */
function withRemoved(lines: readonly string[], remove: readonly string[]) {
  const kept: string[] = []
  let indent = '  '
  let listEnds = -1
  for (const line of lines) {
    if (/^\s*(#.*)?$/.test(line)) {
      kept.push(line)
    } else if (/^\s*-/.test(line)) {
      indent = /^\s*/.exec(line)?.[0] ?? indent
      if (!remove.includes(itemOn(line))) listEnds = kept.push(line)
    } else {
      // The key, `exclude:`, with a flow list or nothing after it.
      const flow = parseExclusions(line).filter((item) => !remove.includes(item))
      kept.push(/^[^:]*:\s*\[/.test(line) ? 'exclude:' : line)
      listEnds = kept.push(...flow.map((item) => `${indent}- ${yamlOf(item)}`))
    }
  }
  return { kept, indent, listEnds }
}

/** Whether `item` holds a line break or another control character, which no list line can hold. */
function breaksLines(item: string): boolean {
  return /[\p{Cc}\u2028\u2029]/u.test(item)
}

/** The item a list line holds, read by the shape's own parser. */
function itemOn(line: string): string {
  return parseExclusions(`exclude:\n${line}`)[0] ?? ''
}

/**
 * `item` as a list line writes it: bare when it holds only letters, digits, `.`, `_`, `-` and a
 * trailing `/`, and doesn't start with `-`; else double-quoted, `\` and `"` escaped, so a glob's
 * `*` or a name's `#` reads back as written.
 */
function yamlOf(item: string): string {
  if (/^[\w.][\w.-]*\/?$/.test(item)) return item
  return `"${item.replace(/[\\"]/g, (character) => `\\${character}`)}"`
}
