// What a Turn's agent is told, appended to Claude Code's own system prompt: what it must know of the
// Turn (its files are a read-only snapshot, every change goes through the MCP naming the Version it
// read, a Conflict means read again, Help is a Tile it can open), where it starts, the Tiles the user
// has on screen, and today's latest Entries of the Conversation, its only memory. Every ancestor's
// `CLAUDE.md` loads by itself from its working folder, so the System's own words are not repeated.
// It holds no secret, ever: the Turn's Key never reaches it. Pure.
import type { Actor, Entry } from '../entities'

/** A Tile as the user has it on screen: its id, its Title and its Preview, as Mapping reads them. */
export interface Glimpse {
  readonly id: string
  readonly title: string
  readonly preview: string
}

/** What a Turn's prompt is made of. */
export interface PromptOf {
  /** Today's latest Entries of the Conversation, oldest first, the Message answered last. */
  readonly entries: ReadonlyArray<Entry>
  /** The Titles of the Tiles the navigations among them went to, by id, as the System holds them. */
  readonly titles: Readonly<Record<string, string>>
  /** The Tiles on the user's screen, the centered one first. */
  readonly onScreen: ReadonlyArray<Glimpse>
  /** The Tile the Turn starts in, and its folder from the System folder, `''` for the Root's. */
  readonly location: { readonly id: string; readonly title: string; readonly folder: string }
  /** The id Help opens at. */
  readonly help: string
}

/** A Tile named in the prompt: its Title, or "an untitled Tile", and its id. */
const named = (title: string | undefined, id: string) =>
  `${title === undefined || title === '' ? 'an untitled Tile' : `"${title}"`} (id ${id})`

/** Who acted, as the agent reads it. */
const actorOf = (actor: Actor): string => {
  switch (actor._tag) {
    case 'You':
      return 'The user'
    case 'Assistant':
      return 'You, the Assistant,'
    case 'Key':
      return actor.name === undefined ? 'A revoked key' : `The key "${actor.name}"`
  }
}

/** How a Turn ended, when not by its answer, as the agent reads it. */
const ends = {
  stopped: 'the user stopped it',
  ceiling: 'it reached its ceiling',
  allowance: "the month's allowance was spent",
  time: 'it ran out of time',
  sandbox: 'its sandbox failed',
} as const

/** One Entry, as a line of the prompt. */
function lineOf(entry: Entry, titles: PromptOf['titles']): string {
  switch (entry._tag) {
    case 'Message':
      return `${entry.author === 'user' ? 'User' : 'You'}: ${entry.text}`
    case 'Change': {
      const other =
        entry.other === undefined ? '' : `, with ${named(entry.other.title, entry.other.id)}`
      return `${actorOf(entry.actor)} ${entry.verb} ${named(entry.tile.title, entry.tile.id)}${other}.`
    }
    case 'Import':
      return `${actorOf(entry.actor)} imported ${named(entry.tile.title, entry.tile.id)} and ${String(entry.count)} Tiles below it.`
    case 'Navigation': {
      const steps = entry.steps.map(
        ({ gesture, tile }) => `${gesture} ${named(titles[tile], tile)}`,
      )
      return `The user moved around the canvas (${String(entry.gestures)} gestures), lastly: ${steps.join(', ')}.`
    }
    case 'TurnEnded':
      return `A Turn of yours ended before its answer: ${ends[entry.how]}.`
  }
}

/** An instant as the prompt dates it: hours and minutes, UTC. */
const timeOf = (at: Date) => `${at.toISOString().slice(11, 16)} UTC`

/** The prompt appended to Claude Code's own, in Markdown. */
export function promptOf({ entries, titles, onScreen, location, help }: PromptOf): string {
  const folder = location.folder === '' ? 'the System folder itself' : `\`${location.folder}\``
  return [
    "# You are hexframe's Assistant",
    '',
    "You build and change the user's System on their behalf: a hierarchy of Tiles, each a Title, a " +
      'Preview and a Body, whose Root is the user, where what comes first matters most. You answer ' +
      "the user's last Message, below, then stop.",
    '',
    '## How this Turn works',
    '',
    '- The files around you are a read-only snapshot of the System as this Turn started: read them ' +
      'to find your way, never write them. Each Tile is a folder or a file, its id and version in ' +
      'its frontmatter.',
    "- Every change goes through the hexframe MCP's tools (create_tile, edit_tile, move_tile, " +
      'swap_tiles, delete_tile, create_reference, delete_reference), naming the version of the Tile ' +
      'you read. What changed since the Turn started, read it through the MCP too (open_tile, map).',
    '- A refusal saying the Tile changed (a Conflict) means someone wrote it since you read it: ' +
      'read it again with open_tile, then decide again.',
    `- Help, hexframe's own guide, opens at open_tile({ id: "${help}" }).`,
    '- Say what you did in a few sentences once you are done: the user reads your answer beside ' +
      'the canvas.',
    '',
    '## Where you are',
    '',
    `You start in ${named(location.title, location.id)}, ${folder}.`,
    '',
    '## On the user’s screen',
    '',
    ...(onScreen.length === 0
      ? ['Nothing.']
      : onScreen.map(
          ({ id, title, preview }) =>
            `- ${named(title, id)}${preview === '' ? '' : `: ${preview}`}`,
        )),
    '',
    '## Today’s conversation, latest last',
    '',
    ...entries.map((entry) => `- ${timeOf(entry.at)}: ${lineOf(entry, titles)}`),
    '',
  ].join('\n')
}
