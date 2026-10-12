// What the composer's field holds, read: the commands home offers and runs, what the caret stands in
// and lists, a `/` opening the field the commands (ui's `commands.ts`), an `@` the Account's Tiles
// (`./mention.ts`), what a pick puts in it, and what a Message sent is, a command run or words for the
// agent; a Tile named from outside, dropped at the caret or first as a tile's menu asks the agent;
// and where the Turn the field's Message starts works. What the field shows marked is ui's
// `fieldMarksOf`, which the gallery's demo reads too. Pure; the composer's state hook
// (`../state/useComposerState.ts`) runs it.
import {
  type Command,
  type CommandId,
  commandPicked,
  commands,
  commandTypingAt,
  languageNamed,
  namedAt,
  namedFirst,
  openingCommand,
  type Picked,
  showsLink,
  tileTyping,
  type Typing,
} from '#/front/ui/chat/composer/commands'
import { type Mode, turnLocation } from '#/domains/assistant/entities'

import {
  type Edited,
  encoded,
  type Inserted,
  inserted,
  matching,
  type Mentionable,
  queryAt,
  shownOf,
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

/** Where a Tile is named from outside: at the caret, as a drop names it, or first, `then` after it. */
export type NameAt = 'caret' | { readonly first: true; readonly then: string }

/**
 * The field with a Tile named from outside, shown as a pick would show it, and the link it adds: at
 * the caret, a tile carried from the canvas let go over the composer; or first, what was written
 * kept, so the next Turn works there, a tile's menu asking the agent (HEX-110).
 */
export function namedIn(
  field: Field,
  tile: Mentionable,
  where: NameAt,
): Edited & { readonly link: Inserted } {
  const shown = shownOf(tile, field.links)
  // ui's naming writes the `@` itself.
  const title = shown.slice(1)
  const edited =
    where === 'caret'
      ? namedAt(field.value, field.caret, title)
      : namedFirst(field.value, title, where.then)
  return { ...edited, link: { id: tile.id, shown } }
}

/**
 * Where the Turn answering what the field sends would work, the canvas centered on `center`, as
 * Assistant decides it (`turnLocation`): the Tile the Message opens with a link to, `first`, else the
 * centered one, the words after a command being the Message; none where no Message goes, a language
 * or a command alone, nor for a Tile the page can't name.
 */
export function workingInOf(
  field: Field,
  {
    center,
    tiles,
    among,
  }: {
    readonly center: string
    readonly tiles: ReadonlyArray<Mentionable>
    readonly among: ReadonlyArray<Command>
  },
): { readonly title: string; readonly first: boolean } | undefined {
  const submitted = submittedOf(field, among)
  const message =
    submitted === undefined || 'language' in submitted
      ? undefined
      : 'message' in submitted
        ? submitted.message
        : submitted.then
  if (message === undefined) return undefined
  const location = turnLocation(message, center)
  const tile = tiles.find(({ id }) => id === location)
  return tile === undefined ? undefined : { title: tile.title, first: location !== center }
}
