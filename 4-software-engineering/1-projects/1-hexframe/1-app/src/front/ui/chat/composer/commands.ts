// What a `/` at the start of a Message offers: the commands that take the place of a menu, each run by
// the app itself, never sent to the agent. On a tile, what the canvas's menu holds; on the agent, what
// the Mode and a Turn answer to; on the user, what the header held, the language among them. Each is
// named in the reader's language; the language also answers to its name in every other one, so a
// reader lost in a language they cannot read still finds it. Pure.
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
import { locales } from '#/paraglide/runtime'

/** Whom a command acts on, the list's groups, in its order. */
export const commandGroups = ['tiles', 'agent', 'you'] as const

type CommandGroup = (typeof commandGroups)[number]

/** What a command takes after its name: a Tile, which opens the `@` search at once, or a word. */
type Takes = 'tile' | 'where' | 'topic'

export interface Command {
  /** The command, whatever the language. */
  readonly id: string
  readonly group: CommandGroup
  /** What is typed after the `/`, in the reader's language. */
  readonly name: () => string
  readonly takes?: Takes
  /** What it does, in a few words. */
  readonly does: () => string
  readonly icon: LucideIcon
}

export const groupNames: Record<CommandGroup, () => string> = {
  tiles: m.composer_group_tiles,
  agent: m.composer_group_agent,
  you: m.composer_group_you,
}

/** What a command shows it takes, after its name. */
export const takesNames: Record<Takes, () => string> = {
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

/** A text compared as a reader would: lower case, accents aside, one character for one. */
const folded = (text: string) =>
  Array.from(text, (character) => {
    const plain = character
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .charAt(0)
    // A mark already apart from its letter, in decomposed text, keeps its place.
    return plain === '' ? character : plain
  }).join('')

/** The names a command answers to: its own, and the language's in every language. */
export const namesOf = (command: Command) =>
  command.id === 'language'
    ? locales.map((locale) => m.composer_command_language({}, { locale }))
    : [command.name()]

/**
 * The commands what was typed after the `/` finds, in their order: those a name of which starts with
 * it, then, from two characters on, those a word of what they do starts with it. Everything, with
 * nothing typed.
 */
export function commandsMatching(typed: string): ReadonlyArray<Command> {
  const text = folded(typed)
  const named = commands.filter((command) =>
    namesOf(command).some((name) => folded(name).startsWith(text)),
  )
  if (text.length < 2) return named
  const described = commands.filter(
    (command) =>
      !named.includes(command) &&
      folded(command.does())
        .split(/[\s\p{P}]+/u)
        .some((word) => word.startsWith(text)),
  )
  return [...named, ...described]
}

/** A text cut around what was typed, where it first shows in it, case and accents aside. */
export interface Cut {
  readonly before: string
  readonly match: string
  readonly after: string
}

/** Where `typed` first shows in `text`; none when it does not, or nothing was typed. */
export function cutAround(text: string, typed: string): Cut | undefined {
  if (typed === '') return undefined
  const at = folded(text).indexOf(folded(typed))
  if (at === -1) return undefined
  const characters = Array.from(text)
  const end = at + Array.from(typed).length
  return {
    before: characters.slice(0, at).join(''),
    match: characters.slice(at, end).join(''),
    after: characters.slice(end).join(''),
  }
}
