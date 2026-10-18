// A public Tile as Markdown, in the order a reader discovers it, as the MCP's `open_tile` reads it:
// its Title, its Preview and its Body, then its Children, its Branches then its Leaves, each by its
// Title and Preview with the link it is read by, then its Context likewise, a Reference by the Tile it
// points at and a broken one left out. What `/t/<id>.md` answers, so any LLM that can fetch a URL
// reads a public Tile and walks on to what Everyone may read below it (HEX-129). Pure.
import {
  contextDirections,
  directions,
  type BrokenReference,
  type Reference,
  type ReadTile,
} from '#/domains/mapping/entities'
import type { Opened } from '#/domains/mapping/mapping'

/** What `/t/<id>.md` reads of a Tile: all three of its fields. */
type Read = 'title' | 'preview' | 'body'

/** A Tile beside the one opened, as the read glimpses it: enough to decide whether to open it. */
type Glimpsed = Pick<ReadTile<'title' | 'preview'>, 'id' | 'title' | 'preview'>

/** The link a Tile's Markdown is read by, from its id. */
export type MarkdownLink = (id: string) => string

/** One line of text: every run of whitespace, line breaks included, one space. */
const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim()

/** Text a link's label holds, its brackets and backslashes escaped so it never closes the label. */
const label = (text: string) => oneLine(text).replace(/[\\[\]]/g, (char) => `\\${char}`)

/** A Title as a reader is shown it: an untitled Tile says so. */
const titleOf = (title: string) => (oneLine(title) === '' ? 'Untitled' : oneLine(title))

/** One Tile beside the one opened, as a list item: its Title, linked, then its Preview. */
function item({ id, title, preview }: Glimpsed, link: MarkdownLink) {
  const said = oneLine(preview)
  return `- [${label(titleOf(title))}](${link(id)})${said === '' ? '' : `: ${said}`}`
}

/** A section of Tiles beside the one opened, under its heading; none when it holds none. */
const section = (heading: string, tiles: ReadonlyArray<Glimpsed>, link: MarkdownLink) =>
  tiles.length === 0 ? [] : [`## ${heading}\n\n${tiles.map((tile) => item(tile, link)).join('\n')}`]

/** What a Context slot shows: its Tile, or the Tile its Reference points at; a broken one nothing. */
function inContext(held: ReadTile<'title' | 'preview'> | Reference<Glimpsed> | BrokenReference) {
  if (held._tag === 'BrokenReference') return []
  return [held._tag === 'Reference' ? held.tile : held]
}

/**
 * A Tile opened, as Markdown: its Title as the heading, its Preview, its Body, then its Children and
 * its Context, each linked by `link`, in their Directions' order.
 */
export function markdownOf(opened: Opened<Read>, link: MarkdownLink): string {
  const { tile, branches, leaves, context } = opened
  const children = [
    ...directions.flatMap((direction) => branches[direction] ?? []),
    ...directions.flatMap((direction) => leaves[direction] ?? []),
  ]
  const around = contextDirections.flatMap((direction) => {
    const held = context[direction]
    return held === undefined ? [] : inContext(held)
  })
  const parts = [
    `# ${titleOf(tile.title)}`,
    tile.preview.trim(),
    tile.body.trim(),
    ...section('Children', children, link),
    ...section('Context', around, link),
  ]
  return `${parts.filter((part) => part !== '').join('\n\n')}\n`
}
