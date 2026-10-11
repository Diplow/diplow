// What the composer's state hook will do on a real page, done here for /design-system alone, on a
// fixture System: what the caret stands in lists, what the field shows marked, and what a pick puts in
// the field. A `/` lists the commands only at the very start of a Message, an `@` the Tiles anywhere a
// word starts; a command that takes a Tile opens the `@` search at once, the language lists the
// languages, each in its own words. The Tiles are the user's own words, not translated.
import { m } from '#/paraglide/messages'
import { getLocale, locales } from '#/paraglide/runtime'

import {
  type Command,
  commandGroups,
  commands,
  commandsMatching,
  groupNames,
  marked,
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
  commands.find((command) =>
    command.id === 'language'
      ? locales.some((locale) => m.composer_command_language({}, { locale }) === name)
      : command.name() === name,
  )

/** Where the first command of a group stands among those found. */
const firstOf = (found: ReadonlyArray<Command>, group: Command['group']) => {
  const at = found.findIndex((command) => command.group === group)
  return at === -1 ? found.length : at
}

const commandRow = (command: Command): Row => ({
  kind: 'command',
  id: command.id,
  name: command.name(),
  takes:
    command.takes === undefined || command.takes === 'language'
      ? undefined
      : takesNames[command.takes](),
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
              .filter((locale) => typed === '' || marked(ownName(locale), typed) !== undefined)
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
  const tile = /(^|\s)@([^@\n]{0,30})$/.exec(before)
  if (tile === null) return undefined
  const typed = tile[2] ?? ''
  const from = before.length - typed.length - 1
  const found = tiles.filter(({ title }) => {
    const cut = marked(title, typed)
    return typed === '' || (cut !== undefined && /(^|\s)$/.test(cut.before))
  })
  // Past a space with nothing found, the user is writing, not searching.
  if (found.length === 0 && /\s/.test(typed)) return undefined
  return {
    kind: 'tile',
    from,
    listing: {
      label: m.composer_tiles_label(),
      typed,
      groups: [
        {
          label: groupNames.tiles(),
          rows: found.slice(0, 8).map((each): Row => ({ kind: 'tile', ...each })),
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
