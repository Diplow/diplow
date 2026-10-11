// What the composer's field holds, read: the commands home offers and runs, what the caret stands in
// and lists, a `/` opening the field the commands (ui's `commands.ts`), an `@` the Account's Tiles
// (`./mention.ts`), what the field shows marked, what a pick puts in it, and what a Message sent is, a
// command run or words for the agent. Pure; the composer's state hook (`../state/useComposerState.ts`)
// runs it.
import {
  type Command,
  type CommandId,
  commandMarkOf,
  commandPicked,
  commands,
  commandTypingAt,
  languageNamed,
  openingCommand,
  type Picked,
  tileTyping,
  type Typing,
} from '#/front/ui/chat/composer/commands'
import type { Mode } from '#/domains/assistant/entities'
import type { Mark } from '#/front/ui/chat/composer/Composer'

import {
  type Edited,
  encoded,
  type Inserted,
  inserted,
  matching,
  type Mentionable,
  queryAt,
  shownOf,
  showsLink,
  wholeLink,
} from './mention'

/**
 * The commands home runs today: the language, and the agent's Mode and its last change. The others
 * the proposal drew wait for their answer and their builds
 * (`hexframe-app-design-system-v1/decisions.md#DEC-33`).
 */
const run = ['ask', 'apply', 'undo', 'language'] as const satisfies ReadonlyArray<CommandId>

/** A command home runs. */
export type RunCommand = (typeof run)[number]

/** The Mode each of the Mode's commands switches to, in Assistant's words. */
export const modeOf = { ask: 'ask', apply: 'apply' } as const satisfies Record<
  Extract<RunCommand, 'ask' | 'apply'>,
  Mode
>

/** What the page can do now, which decides the commands it offers. */
export interface Offering {
  /** The Mode is shown and may be switched. */
  readonly modes: boolean
  /** Something the agent applied may be undone. */
  readonly undoable: boolean
}

/** The commands offered now, in their order: those home runs, and of those, what can be done now. */
export function offered({ modes, undoable }: Offering): ReadonlyArray<Command> {
  const now: ReadonlySet<CommandId> = new Set(
    run.filter((id) => (id === 'undo' ? undoable : id === 'language' || modes)),
  )
  return commands.filter((command) => now.has(command.id))
}

/** What the field holds, and what the composer knows besides. */
export interface Field {
  readonly value: string
  readonly caret: number
  /** The links picked since the last Message. */
  readonly links: ReadonlyArray<Inserted>
}

/** What the caret stands in, among the commands offered and the Tiles; nothing when no search. */
export function typingAt(
  { value, caret, links }: Field,
  tiles: ReadonlyArray<Mentionable>,
  among: ReadonlyArray<Command>,
): Typing | undefined {
  const before = value.slice(0, caret)
  const command = commandTypingAt(before, among)
  if (command !== undefined) return command
  const query = queryAt(value, caret)
  // The `@` of a link picked, the field still showing it whole, opens no search of its own.
  if (query === undefined || showsLink(value, query.at, links)) return undefined
  return tileTyping(
    before,
    query.at,
    matching(tiles, query.text).map(({ id, title, trail }) => ({
      kind: 'tile' as const,
      id,
      title,
      path: trail.join(' / '),
    })),
  )
}

/** What the field shows marked: the command it opens with, and each link picked it still shows whole. */
export function marksOf(
  { value, links }: Field,
  among: ReadonlyArray<Command>,
): ReadonlyArray<Mark> {
  const marks: Mark[] = [...commandMarkOf(value, among)]
  // The longest first, as the Message sends them, so a link another starts with never takes its place.
  for (const { shown } of [...links].sort((a, b) => b.shown.length - a.shown.length)) {
    for (const found of value.matchAll(wholeLink(shown))) {
      const mark = { from: found.index, to: found.index + found[0].length, kind: 'tile' as const }
      if (!marks.some(({ from, to }) => mark.from < to && from < mark.to)) marks.push(mark)
    }
  }
  return marks
}

/** What a pick does to the field: its next value and caret, the link it picked if any, or a language. */
export type FieldPick = Picked | (Edited & { readonly link: Inserted })

/** The pick of `row` for what the caret stands in, among the Tiles. */
export function pickOf(
  field: Field,
  typing: Typing,
  row: string,
  tiles: ReadonlyArray<Mentionable>,
): FieldPick {
  const command: Picked | undefined = commandPicked(field.value, field.caret, typing, row)
  if (command !== undefined) return command
  const tile = tiles.find((each) => each.id === row)
  const query = queryAt(field.value, field.caret)
  if (tile === undefined || query === undefined) return { value: field.value, caret: field.caret }
  const shown = shownOf(tile, field.links)
  return { ...inserted(field.value, query, shown), link: { id: tile.id, shown } }
}

/**
 * What the field submits: a language to go to; the Mode or an Undo, and the words after the command,
 * if any, a Message to send once it ran; or a Message, trimmed, each link picked by its Tile's id. A
 * `/` no command offered answers is sent as words, as the list says. None when it names a language
 * hexframe is not in: the field keeps what was typed.
 */
export type Submitted =
  | { readonly language: string }
  | { readonly command: Exclude<RunCommand, 'language'>; readonly then?: string }
  | { readonly message: string }

export function submittedOf(
  { value, links }: Field,
  among: ReadonlyArray<Command>,
): Submitted | undefined {
  const opening = openingCommand(value, among)
  const id = opening?.command.id
  if (opening === undefined || !isRun(id)) return { message: encoded(value.trim(), links) }
  if (id === 'language') {
    const language = languageNamed(opening.rest)
    return language === undefined ? undefined : { language }
  }
  const then = encoded(opening.rest, links)
  return then === '' ? { command: id } : { command: id, then }
}

const isRun = (id: CommandId | undefined): id is RunCommand => run.some((each) => each === id)
