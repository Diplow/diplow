// What the feature's state hook does on home, done here for /design-system alone, on a fixture System
// and every command: what the caret stands in lists, what the field shows marked, what a pick puts in
// the field, and the links picked since the last Message. The commands' part is `commands.ts`', which
// the feature runs too, and so are how the field shows a link picked and what it marks; the rest of
// the `@` follows the rules of the feature's (`features/conversation/composer/mention.ts`, which `ui/`
// cannot import), on the fixture's Tiles, or on those its caller hands it, the canvas's own for the
// crossings. The Tiles are the user's own words, not translated. `useComposerDemo` holds it all as the
// state hook would.
import { useRef, useState } from 'react'

import { m } from '#/paraglide/messages'

import { cutAround } from '../atoms/cut'
import {
  commandPicked,
  commandTypingAt,
  fieldMarksOf,
  namedAt,
  namedFirst,
  type Picked,
  put,
  showsLink,
  tileTyping,
  type Typing,
  wholeLink,
} from './commands'
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

/** A link picked: the Tile, and how the field shows it, `@` and its Title. */
interface Link {
  readonly id: string
  readonly shown: string
}

/** What the caret, at `caret` in `value`, stands in; nothing when it stands in no search. */
export function typingAt(
  value: string,
  caret: number,
  among: ReadonlyArray<DemoTile> = tiles,
  links: ReadonlyArray<Link> = [],
): Typing | undefined {
  const before = value.slice(0, caret)
  return commandTypingAt(before) ?? tileTypingAt(value, caret, among, links)
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
 * The `@` of a link picked, the field still showing it whole, opens no search of its own.
 */
function tileTypingAt(
  value: string,
  caret: number,
  among: ReadonlyArray<DemoTile>,
  links: ReadonlyArray<Link>,
): Typing | undefined {
  const before = value.slice(0, caret)
  const from = before.lastIndexOf('@')
  if (from === -1 || (from > 0 && !/\s/.test(before.charAt(from - 1)))) return undefined
  const typed = before.slice(from + 1)
  if (typed.length > longestQuery || /[\n\r]/.test(typed) || typed.startsWith(' ')) return undefined
  if (showsLink(value, from, links)) return undefined
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

/** A Tile's link, as the field shows it. */
const linkOf = ({ id, title }: Pick<DemoTile, 'id' | 'title'>): Link => ({ id, shown: `@${title}` })

/**
 * The links a specimen opens with: each Tile its first words name whole, as though picked, since it
 * opens on a Message being written.
 */
const linksIn = (value: string, among: ReadonlyArray<DemoTile>) =>
  among.map(linkOf).filter(({ shown }) => wholeLink(shown).test(value))

/** The pick of `row` for what the caret stands in, and the link it picked, if a Tile's. */
function picked(
  value: string,
  caret: number,
  typing: Typing,
  row: string,
  among: ReadonlyArray<DemoTile>,
): Picked & { readonly link?: Link } {
  const command = commandPicked(value, caret, typing, row)
  if (command !== undefined) return command
  const link = linkOf(among.find((each) => each.id === row) ?? { id: row, title: row })
  return { ...put(value, caret, typing, `${link.shown} `), link }
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
 * stands, what that lists, the links picked since the last Message, a pick, the list left, the Mode;
 * `name`, a Tile named from outside, at the caret as a drop names it or first as a tile's menu asks
 * the agent, then the focus in the field; and `clear`, once a Message is sent.
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
  const [links, setLinks] = useState(() => linksIn(initial, among))
  const [left, setLeft] = useState(!listed)
  const [mode, setMode] = useState('ask')
  const typing = left ? undefined : typingAt(value, caret, among, links)
  const edit = (next: string, at: number) => {
    const element = field.current
    if (element !== null) {
      // Set on the element first, so React finds it as it is and leaves the caret be.
      element.value = next
      element.setSelectionRange(at, at)
    }
    setValue(next)
    setCaret(at)
    setLeft(false)
  }
  return {
    value,
    caret,
    links,
    name: (tile: Pick<DemoTile, 'id' | 'title'>, where: 'caret' | { first: string }) => {
      const named =
        where === 'caret'
          ? namedAt(value, caret, tile.title)
          : namedFirst(value, tile.title, where.first)
      edit(named.value, named.caret)
      setLinks([...links, linkOf(tile)])
      field.current?.focus()
    },
    clear: () => {
      edit('', 0)
      setLinks([])
    },
    composer: {
      fieldRef: field,
      value,
      onChange: (next: string, at: number) => {
        setValue(next)
        setCaret(at)
        setLeft(false)
      },
      marks: fieldMarksOf(value, links),
      listing: typing?.listing,
      onPick: (row: string) => {
        if (typing === undefined) return
        const pick = picked(value, caret, typing, row, among)
        if ('language' in pick) onLanguage?.(pick.language)
        else edit(pick.value, pick.caret)
        if (pick.link !== undefined) setLinks([...links, pick.link])
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
