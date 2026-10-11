// What the feature's state hook does on home, done here for /design-system alone, on a fixture System
// and every command: what the caret stands in lists, what the field shows marked, and what a pick puts
// in the field. The commands' part is `commands.ts`', which the feature runs too; the `@` follows the
// rules of the feature's (`features/conversation/composer/mention.ts`, which `ui/` cannot import), on
// the fixture's Tiles. The Tiles are the user's own words, not translated.
import { m } from '#/paraglide/messages'

import { cutAround } from '../atoms/cut'
import {
  commandMarkOf,
  commandPicked,
  commandTypingAt,
  type Picked,
  put,
  tileTyping,
  type Typing,
} from './commands'
import type { Mark } from './Composer'
import type { Row } from './List'

/** A Tile of the fixture System: its Title, and the Titles above it. */
interface FixtureTile {
  readonly id: string
  readonly title: string
  readonly path: string
}

const tiles: ReadonlyArray<FixtureTile> = [
  ['software', 'Software engineering', 'diplow'],
  ['projects', 'Projects', 'diplow / Software engineering'],
  ['principles', 'Principles', 'diplow / Software engineering'],
  ['design-system', 'Design system', 'diplow / Software engineering'],
  ['tooling', 'Tooling', 'diplow / Software engineering'],
  ['hexframe', 'hexframe', 'Software engineering / Projects'],
  ['site', 'Site', 'Software engineering / Projects'],
  ['leadership', 'Leadership', 'diplow'],
  ['education', 'Education', 'diplow'],
  ['games', 'Games', 'diplow'],
  ['startups', 'Startups', 'diplow'],
  ['politics', 'Politics', 'diplow'],
  ['ddd', 'Domain-driven design', 'Software engineering / Principles'],
  ['feedback-principles', 'Feedback', 'Software engineering / Principles'],
  ['feedback-leadership', 'Feedback', 'diplow / Leadership'],
].map(([id, title, path]) => ({ id, title, path }) as FixtureTile)

/** What the caret, at `caret` in `value`, stands in; nothing when it stands in no search. */
export function typingAt(value: string, caret: number): Typing | undefined {
  const before = value.slice(0, caret)
  return commandTypingAt(before) ?? tileTypingAt(before)
}

/** The most characters a search reads after its `@`, and the most Tiles it offers, as the feature's. */
const longestQuery = 40
const mostOffered = 8

/** How well a Title answers a search: starting with it, then a word starting with it, then holding it. */
function rank(title: string, typed: string): number | undefined {
  const cut = cutAround(title, typed)
  if (cut === undefined) return typed === '' ? 0 : undefined
  if (cut.before === '') return 0
  return /[\s\p{P}]$/u.test(cut.before) ? 1 : 2
}

/**
 * The `@` search the caret stands in: the last `@` before it, opening a word, with no line break since
 * and at most `longestQuery` characters typed; its Tiles, the best first, then the nearest the Root.
 */
function tileTypingAt(before: string): Typing | undefined {
  const from = before.lastIndexOf('@')
  if (from === -1 || (from > 0 && !/\s/.test(before.charAt(from - 1)))) return undefined
  const typed = before.slice(from + 1)
  if (typed.length > longestQuery || /[\n\r]/.test(typed) || typed.startsWith(' ')) return undefined
  const found = tiles
    .flatMap((tile, order) => {
      const ranked = rank(tile.title, typed.trim())
      return ranked === undefined ? [] : [{ tile, ranked, order }]
    })
    .sort((a, b) => a.ranked - b.ranked || a.order - b.order)
    .slice(0, mostOffered)
  return tileTyping(
    before,
    from,
    found.map(({ tile }): Row => ({ kind: 'tile', ...tile })),
  )
}

/** A text read as itself inside a pattern. */
const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** What the field shows marked: the command it opens with, and each Tile it points at by its Title. */
export function marksOf(value: string): ReadonlyArray<Mark> {
  const command = commandMarkOf(value)
  const pointed = tiles.flatMap(({ title }) =>
    Array.from(
      value.matchAll(new RegExp(`(?<!\\S)@${escaped(title)}(?![\\p{L}\\p{N}])`, 'gu')),
      (found) => ({
        from: found.index,
        to: found.index + found[0].length,
        kind: 'tile' as const,
      }),
    ),
  )
  return [...command, ...pointed]
}

/** The pick of `row` for what the caret stands in. */
export function picked(value: string, caret: number, typing: Typing, row: string): Picked {
  const command = commandPicked(value, caret, typing, row)
  if (command !== undefined) return command
  const tile = tiles.find((each) => each.id === row)
  return put(value, caret, typing, `@${tile?.title ?? row} `)
}

/** Assistant's two Modes, as a real page builds them from its `Mode`. */
export const modeChoices = () => [
  { id: 'ask', label: m.composer_mode_ask(), means: m.conversation_mode_ask_hint() },
  { id: 'apply', label: m.composer_mode_apply(), means: m.conversation_mode_apply_hint() },
]
