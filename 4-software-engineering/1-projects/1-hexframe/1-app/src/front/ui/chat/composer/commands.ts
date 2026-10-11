// What a `/` at the start of a Message offers: the commands that take the place of a menu, each run by
// the app itself, never sent to the agent. On a tile, what the canvas's menu holds; on the agent, what
// the Mode and a Turn answer to; on the user, what the header held, the language among them. Each is
// named in the reader's language; the language also answers to its name in every other one, so a
// reader lost in a language they cannot read still finds it. A page offers those it runs (`among`):
// what the caret stands in lists them (`commandTypingAt`), the command a Message opens with is marked
// in the field (`commandMarkOf`) and run once sent (`openingCommand`), and the language lists the
// languages, each in its own words. Pure.
import {
  ArrowUpRight,
  Check,
  CircleHelp,
  Download,
  Hexagon,
  KeyRound,
  Languages,
  LogOut,
  Move,
  Pencil,
  Sparkles,
  Square,
  Trash2,
  Undo2,
  type LucideIcon,
} from 'lucide-react'

import { m } from '#/paraglide/messages'
import { getLocale, locales } from '#/paraglide/runtime'

import { cutAround, folded } from '../atoms/cut'
import type { Mark } from './Composer'
import type { Listing, Row } from './List'

/** Whom a command acts on, the list's groups, in its order. */
export const commandGroups = ['tiles', 'agent', 'you'] as const

type CommandGroup = (typeof commandGroups)[number]

/** What a command takes after its name: a Tile, which opens the `@` search at once, or a word. */
type Takes = 'tile' | 'where' | 'topic'

/** Each command, whatever the language. */
export type CommandId =
  | 'new'
  | 'edit'
  | 'move'
  | 'delete'
  | 'import'
  | 'export'
  | 'ask'
  | 'apply'
  | 'undo'
  | 'stop'
  | 'language'
  | 'keys'
  | 'help'
  | 'sign-out'

export interface Command {
  readonly id: CommandId
  readonly group: CommandGroup
  /** What is typed after the `/`, in the reader's language. */
  readonly name: () => string
  readonly takes?: Takes
  /** What it does, in a few words. */
  readonly does: () => string
  readonly icon: LucideIcon
}

const groupNames: Record<CommandGroup, () => string> = {
  tiles: m.composer_group_tiles,
  agent: m.composer_group_agent,
  you: m.composer_group_you,
}

/** What a command shows it takes, after its name. */
const takesNames: Record<Takes, () => string> = {
  tile: m.composer_takes_tile,
  where: m.composer_takes_where,
  topic: m.composer_takes_topic,
}

/** The commands, group after group. */
export const commands: ReadonlyArray<Command> = [
  {
    id: 'new',
    group: 'tiles',
    name: m.composer_command_new,
    takes: 'where',
    does: m.composer_command_new_does,
    icon: Hexagon,
  },
  {
    id: 'edit',
    group: 'tiles',
    name: m.composer_command_edit,
    takes: 'tile',
    does: m.composer_command_edit_does,
    icon: Pencil,
  },
  {
    id: 'move',
    group: 'tiles',
    name: m.composer_command_move,
    takes: 'tile',
    does: m.composer_command_move_does,
    icon: Move,
  },
  {
    id: 'delete',
    group: 'tiles',
    name: m.composer_command_delete,
    takes: 'tile',
    does: m.composer_command_delete_does,
    icon: Trash2,
  },
  {
    id: 'import',
    group: 'tiles',
    name: m.composer_command_import,
    does: m.composer_command_import_does,
    icon: Download,
  },
  {
    id: 'export',
    group: 'tiles',
    name: m.composer_command_export,
    takes: 'tile',
    does: m.composer_command_export_does,
    icon: ArrowUpRight,
  },
  {
    id: 'ask',
    group: 'agent',
    name: m.composer_command_ask,
    does: m.composer_command_ask_does,
    icon: Sparkles,
  },
  {
    id: 'apply',
    group: 'agent',
    name: m.composer_command_apply,
    does: m.composer_command_apply_does,
    icon: Check,
  },
  {
    id: 'undo',
    group: 'agent',
    name: m.composer_command_undo,
    does: m.composer_command_undo_does,
    icon: Undo2,
  },
  {
    id: 'stop',
    group: 'agent',
    name: m.composer_command_stop,
    does: m.composer_command_stop_does,
    icon: Square,
  },
  {
    id: 'language',
    group: 'you',
    name: m.composer_command_language,
    does: m.composer_command_language_does,
    icon: Languages,
  },
  {
    id: 'keys',
    group: 'you',
    name: m.composer_command_keys,
    does: m.composer_command_keys_does,
    icon: KeyRound,
  },
  {
    id: 'help',
    group: 'you',
    name: m.composer_command_help,
    takes: 'topic',
    does: m.composer_command_help_does,
    icon: CircleHelp,
  },
  {
    id: 'sign-out',
    group: 'you',
    name: m.composer_command_sign_out,
    does: m.composer_command_sign_out_does,
    icon: LogOut,
  },
]

/** The names a command answers to: its own, and the language's in every language. */
const namesOf = (command: Command) =>
  command.id === 'language'
    ? locales.map((locale) => m.composer_command_language({}, { locale }))
    : [command.name()]

/**
 * The commands of `among` what was typed after the `/` finds, in their order: those a name of which
 * starts with it, then, from two characters on, those a word of what they do starts with it. All of
 * them, with nothing typed.
 */
export function commandsMatching(
  typed: string,
  among: ReadonlyArray<Command> = commands,
): ReadonlyArray<Command> {
  const text = folded(typed)
  const named = among.filter((command) =>
    namesOf(command).some((name) => folded(name).startsWith(text)),
  )
  if (text.length < 2) return named
  const described = among.filter(
    (command) =>
      !named.includes(command) &&
      folded(command.does())
        .split(/[\s\p{P}]+/u)
        .some((word) => word.startsWith(text)),
  )
  return [...named, ...described]
}

/** What the caret stands in: what it lists, and where what was typed starts, the `/` or the `@`. */
export interface Typing {
  readonly kind: 'command' | 'tile' | 'language'
  readonly listing: Listing
  readonly from: number
}

/**
 * The command of `among` a name calls, case and accents aside as the list finds it, in any language
 * for the language.
 */
const commandNamed = (name: string, among: ReadonlyArray<Command> = commands) =>
  among.find((command) => namesOf(command).some((each) => folded(each) === folded(name)))

/** Where the first command of a group stands among those found. */
const firstOf = (found: ReadonlyArray<Command>, group: CommandGroup) => {
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

/** The languages a text after the language finds: those whose own name holds it, all with none. */
const languagesMatching = (typed: string) =>
  locales.filter((locale) => typed === '' || cutAround(ownName(locale), typed) !== undefined)

/**
 * The language a text sent after the language names: its code, or the first whose own name holds
 * it; none when it names none.
 */
export const languageNamed = (typed: string): string | undefined =>
  typed === ''
    ? undefined
    : (locales.find((locale) => folded(locale) === folded(typed)) ?? languagesMatching(typed)[0])

/**
 * What a command stands in, `before` being the field up to its caret: the commands of `among` while a
 * `/` opens the field and no space came yet, each group where its best command stands, so the first
 * row is the best found; once the language and a space, the languages; else nothing.
 */
export function commandTypingAt(
  before: string,
  among: ReadonlyArray<Command> = commands,
): Typing | undefined {
  const command = /^\/(\S*)$/.exec(before)
  if (command !== null) {
    const typed = command[1] ?? ''
    const found = commandsMatching(typed, among)
    return {
      kind: 'command',
      from: 0,
      listing: {
        label: m.composer_commands_label(),
        typed,
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
  if (language === null || commandNamed(language[1] ?? '', among)?.id !== 'language') {
    return undefined
  }
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
          rows: languagesMatching(typed).map((locale): Row => ({
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

/**
 * What an `@` lists, `from` its place in `before`, the field up to its caret, the Tiles found in
 * `rows`, whoever found them: the tip says what a Tile named first does, or that the agent is told
 * where it is; nothing after a command, which takes the Tile it names.
 */
export function tileTyping(before: string, from: number, rows: ReadonlyArray<Row>): Typing {
  const typed = before.slice(from + 1)
  return {
    kind: 'tile',
    from,
    listing: {
      label: m.composer_tiles_label(),
      typed: typed.trim(),
      groups: [{ label: groupNames.tiles(), rows }].filter((group) => group.rows.length > 0),
      none: m.composer_none_tile({ typed }),
      tip: before.startsWith('/')
        ? undefined
        : from === 0
          ? m.composer_tip_named_first()
          : m.composer_tip_where_it_is(),
    },
  }
}

/** The command of `among` a Message opens with, and what follows it; none when it opens with none. */
export function openingCommand(
  value: string,
  among: ReadonlyArray<Command> = commands,
): { readonly command: Command; readonly length: number; readonly rest: string } | undefined {
  const opening = /^\/(\S+)(?=\s|$)/.exec(value)
  const command = opening === null ? undefined : commandNamed(opening[1] ?? '', among)
  if (opening === null || command === undefined) return undefined
  return { command, length: opening[0].length, rest: value.slice(opening[0].length).trim() }
}

/** The command a Message opens with, marked in the field. */
export function commandMarkOf(value: string, among: ReadonlyArray<Command> = commands): Mark[] {
  const opening = openingCommand(value, among)
  return opening === undefined ? [] : [{ from: 0, to: opening.length, kind: 'command' }]
}

/** What a pick does: the field's next value and caret, or a language to go to. */
export type Picked =
  { readonly value: string; readonly caret: number } | { readonly language: string }

/**
 * The field once `inserted` takes the place of what was typed since `typing` began, the caret at the
 * caret, `inserted` and the caret after it.
 */
export function put(value: string, caret: number, typing: Typing, inserted: string) {
  return {
    value: `${value.slice(0, typing.from)}${inserted}${value.slice(caret).replace(/^ /, '')}`,
    caret: typing.from + inserted.length,
  }
}

/**
 * The pick of a command's or a language's row: a language to go to, or the command's name in the
 * field, opening the `@` search at once when it takes a Tile. None for a Tile's row.
 */
export function commandPicked(
  value: string,
  caret: number,
  typing: Typing,
  row: string,
): Picked | undefined {
  if (typing.kind === 'language') return { language: row }
  if (typing.kind !== 'command') return undefined
  const command = commands.find((each) => each.id === row)
  if (command === undefined) return { value, caret }
  return put(value, caret, typing, `/${command.name()} ${command.takes === 'tile' ? '@' : ''}`)
}
