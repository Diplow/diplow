// What the composer's state hook will do on a real page, done here for /design-system alone, on a
// fixture System: what the caret stands in lists, what the field shows marked, and what a pick puts in
// the field. A `/` lists the commands only at the very start of a Message, an `@` the Tiles anywhere a
// word starts, by the rules of the feature's `@` (`features/conversation/composer/mention.ts`, which
// `ui/` cannot import); a command that takes a Tile opens the `@` search at once, the language lists
// the languages, each in its own words. The Tiles are the user's own words, not translated.
import { m } from '#/paraglide/messages'
import { getLocale, locales } from '#/paraglide/runtime'

import {
  type Command,
  commandGroups,
  commands,
  commandsMatching,
  cutAround,
  groupNames,
  namesOf,
  takesNames,
} from './commands'
import type { Mark } from './Composer'
import type { Listing, Row } from './List'

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

/** What the caret stands in: what it lists, and where what was typed starts, the `/` or the `@`. */
export interface Typing {
  readonly kind: 'command' | 'tile' | 'language'
  readonly listing: Listing
  readonly from: number
}

/** The command a name opens a Message with, in any language for the language. */
const commandNamed = (name: string): Command | undefined =>
  commands.find((command) => namesOf(command).includes(name))

/** Where the first command of a group stands among those found. */
const firstOf = (found: ReadonlyArray<Command>, group: Command['group']) => {
  const at = found.findIndex((command) => command.group === group)
  return at === -1 ? found.length : at
}

const commandRow = (command: Command): Row => ({
  kind: 'command',
  id: command.id,
  name: command.name(),
  takes: command.takes === undefined ? undefined : takesNames[command.takes](),
  does: command.does(),
  icon: command.icon,
})

/** A language as it names itself, its first letter up. */
const ownName = (locale: string) => {
  const name = new Intl.DisplayNames([locale], { type: 'language' }).of(locale) ?? locale
  return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1)
}

/** What the caret, at `caret` in `value`, stands in; nothing when it stands in no search. */
export function typingAt(value: string, caret: number): Typing | undefined {
  const before = value.slice(0, caret)
  const command = /^\/(\S*)$/.exec(before)
  if (command !== null) {
    const typed = command[1] ?? ''
    const found = commandsMatching(typed)
    return {
      kind: 'command',
      from: 0,
      listing: {
        label: m.composer_commands_label(),
        typed,
        // Each group where its best command stands, so the first row is the best found.
        groups: [...commandGroups]
          .sort((a, b) => firstOf(found, a) - firstOf(found, b))
          .map((group) => ({
            label: groupNames[group](),
            rows: found.filter((each) => each.group === group).map(commandRow),
          }))
          .filter((group) => group.rows.length > 0),
        none: m.composer_none_command({ typed: `/${typed}` }),
      },
    }
  }
  const language = /^\/(\S+) (\S*)$/.exec(before)
  if (language !== null && commandNamed(language[1] ?? '')?.id === 'language') {
    const typed = language[2] ?? ''
    return {
      kind: 'language',
      from: before.length - typed.length,
      listing: {
        label: m.composer_languages_label(),
        typed,
        groups: [
          {
            label: m.composer_group_languages(),
            rows: locales
              .filter((locale) => typed === '' || cutAround(ownName(locale), typed) !== undefined)
              .map((locale): Row => ({
                kind: 'choice',
                id: locale,
                label: ownName(locale),
                lang: locale,
                current: locale === getLocale(),
              })),
          },
        ].filter((group) => group.rows.length > 0),
        none: m.composer_none_language({ typed }),
      },
    }
  }
  return tileTyping(before)
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
function tileTyping(before: string): Typing | undefined {
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
  return {
    kind: 'tile',
    from,
    listing: {
      label: m.composer_tiles_label(),
      typed: typed.trim(),
      groups: [
        {
          label: groupNames.tiles(),
          rows: found.map(({ tile }): Row => ({ kind: 'tile', ...tile })),
        },
      ].filter((group) => group.rows.length > 0),
      none: m.composer_none_tile({ typed }),
      tip: before.startsWith('/')
        ? undefined
        : from === 0
          ? m.composer_tip_named_first()
          : m.composer_tip_where_it_is(),
    },
  }
}

/** A text read as itself inside a pattern. */
const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** What the field shows marked: the command it opens with, and each Tile it points at by its Title. */
export function marksOf(value: string): ReadonlyArray<Mark> {
  const opening = /^\/(\S+)(?=\s|$)/.exec(value)
  const command: Mark[] =
    opening !== null && commandNamed(opening[1] ?? '') !== undefined
      ? [{ from: 0, to: opening[0].length, kind: 'command' }]
      : []
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

/** What a pick does: the field's next value and caret, or a language to go to. */
export type Picked =
  { readonly value: string; readonly caret: number } | { readonly language: string }

/** The pick of `row` for what the caret stands in. */
export function picked(value: string, caret: number, typing: Typing, row: string): Picked {
  if (typing.kind === 'language') return { language: row }
  const put = (inserted: string) => ({
    value: `${value.slice(0, typing.from)}${inserted}${value.slice(caret).replace(/^ /, '')}`,
    caret: typing.from + inserted.length,
  })
  if (typing.kind === 'tile') {
    const tile = tiles.find((each) => each.id === row)
    return put(`@${tile?.title ?? row} `)
  }
  const command = commands.find((each) => each.id === row)
  if (command === undefined) return { value, caret }
  return put(`/${command.name()} ${command.takes === 'tile' ? '@' : ''}`)
}

/** Assistant's two Modes, as a real page builds them from its `Mode`. */
export const modeChoices = () => [
  { id: 'ask', label: m.composer_mode_ask(), means: m.conversation_mode_ask_hint() },
  { id: 'apply', label: m.composer_mode_apply(), means: m.conversation_mode_apply_hint() },
]
