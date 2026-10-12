// What the feature's state hook does on home, done here for /design-system alone, on a fixture System
// and every command: what the caret stands in lists, what the field shows marked, and what a pick puts
// in the field. The commands' part is `commands.ts`', which the feature runs too; the `@` follows the
// rules of the feature's (`features/conversation/composer/mention.ts`, which `ui/` cannot import), on
// the fixture's Tiles, or on those its caller hands it, the canvas's own for the crossings. The Tiles
// are the user's own words, not translated. `useComposerDemo` holds it all as the state hook would.
import { useRef, useState } from 'react'

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

/** A Tile the demo's `@` finds: its Title, and the Titles above it. */
export interface DemoTile {
  readonly id: string
  readonly title: string
  readonly path: string
}

const tiles: ReadonlyArray<DemoTile> = [
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
].map(([id, title, path]) => ({ id, title, path }) as DemoTile)

/** What the caret, at `caret` in `value`, stands in; nothing when it stands in no search. */
export function typingAt(
  value: string,
  caret: number,
  among: ReadonlyArray<DemoTile> = tiles,
): Typing | undefined {
  const before = value.slice(0, caret)
  return commandTypingAt(before) ?? tileTypingAt(before, among)
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

/** A text read as itself inside a pattern. */
const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * The `@` search the caret stands in: the last `@` before it, opening a word, with no line break since
 * and at most `longestQuery` characters typed; its Tiles, the best first, then the nearest the Root.
 * A Tile named whole there, words going on after it that no longer Title goes on with, is a link, and
 * opens no search of its own, as the feature's `showsLink` says of a link picked.
 */
function tileTypingAt(before: string, among: ReadonlyArray<DemoTile>): Typing | undefined {
  const from = before.lastIndexOf('@')
  if (from === -1 || (from > 0 && !/\s/.test(before.charAt(from - 1)))) return undefined
  const typed = before.slice(from + 1)
  if (typed.length > longestQuery || /[\n\r]/.test(typed) || typed.startsWith(' ')) return undefined
  const named = among.some(({ title }) => new RegExp(`^${escaped(title)}\\s`, 'u').test(typed))
  const longer = among.some(({ title }) => title.toLowerCase().startsWith(typed.toLowerCase()))
  if (named && !longer) return undefined
  const found = among
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

/** What the field shows marked: the command it opens with, and each Tile it points at by its Title. */
function marksOf(value: string, among: ReadonlyArray<DemoTile> = tiles): ReadonlyArray<Mark> {
  const command = commandMarkOf(value)
  const pointed = among.flatMap(({ title }) =>
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
function picked(
  value: string,
  caret: number,
  typing: Typing,
  row: string,
  among: ReadonlyArray<DemoTile> = tiles,
): Picked {
  const command = commandPicked(value, caret, typing, row)
  if (command !== undefined) return command
  const tile = among.find((each) => each.id === row)
  return put(value, caret, typing, `@${tile?.title ?? row} `)
}

interface DemoOptions {
  /** What the field holds at first, the caret at its end. */
  initial?: string
  /** Whether what the caret stands in lists at first. */
  listed?: boolean
  /** The Tiles its `@` finds: the fixture's, by default. */
  among?: ReadonlyArray<DemoTile>
  /** A language picked: a real page goes to it. */
  onLanguage?: (language: string) => void
}

/**
 * The composer as a page's state hook holds it, for a specimen: what is typed and where the caret
 * stands, what that lists, a pick, the list left, the Mode; and `edit`, the field set from outside, a
 * tile named or a Message sent, the caret where it says and the focus in the field.
 */
export function useComposerDemo({
  initial = '',
  listed = true,
  among = tiles,
  onLanguage,
}: DemoOptions = {}) {
  const field = useRef<HTMLTextAreaElement>(null)
  const [value, setValue] = useState(initial)
  const [caret, setCaret] = useState(initial.length)
  const [left, setLeft] = useState(!listed)
  const [mode, setMode] = useState('ask')
  const typing = left ? undefined : typingAt(value, caret, among)
  const edit = (next: string, at: number, focus = false) => {
    const element = field.current
    if (element !== null) {
      // Set on the element first, so React finds it as it is and leaves the caret be.
      element.value = next
      element.setSelectionRange(at, at)
      // A task later: a menu whose line asked for it holds the focus until it has closed.
      if (focus) {
        setTimeout(() => {
          element.focus()
        }, 0)
      }
    }
    setValue(next)
    setCaret(at)
    setLeft(false)
  }
  return {
    value,
    caret,
    edit,
    composer: {
      fieldRef: field,
      value,
      onChange: (next: string, at: number) => {
        setValue(next)
        setCaret(at)
        setLeft(false)
      },
      marks: marksOf(value, among),
      listing: typing?.listing,
      onPick: (row: string) => {
        if (typing === undefined) return
        const pick = picked(value, caret, typing, row, among)
        if ('language' in pick) onLanguage?.(pick.language)
        else edit(pick.value, pick.caret)
      },
      onLeave: () => {
        setLeft(true)
      },
      mode: { choices: modeChoices(), on: mode, choose: setMode },
    },
  }
}

/** Assistant's two Modes, as a real page builds them from its `Mode`. */
export const modeChoices = () => [
  { id: 'ask', label: m.composer_mode_ask(), means: m.conversation_mode_ask_hint() },
  { id: 'apply', label: m.composer_mode_apply(), means: m.conversation_mode_apply_hint() },
]
