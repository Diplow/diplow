import { Result } from 'effect'
import { describe, expect, it } from 'vitest'

import type { TileRow } from '#/repositories/database/tiles/tiles'

import {
  type BrokenReference,
  keepsNothing,
  type LeafTile,
  type Reference,
  systemOf,
  type SystemTile,
} from '../../entities'
import { type File, exportOf } from '../files'
import type { PlannedLeaf, PlannedReference, PlannedTile } from './plan'
import { importOf } from './read'

// A System written as files by the export, then read back by the import: the same tree, Names, configs,
// Frontmatter, References inside, Leaves Markdown and not; and the plan, exported in turn, writes the
// same files but for the ids, which an import never keeps.

const row = (id: string, parentId: string | null, direction: number | null): TileRow => ({
  id,
  parentId,
  direction,
  title: id,
  preview: `${id}, in short.`,
  body: `# ${id}\n\nLine two.\n`,
  target: null,
  ...keepsNothing,
})

const reference = (id: string, parentId: string, direction: number, target: string): TileRow => ({
  ...row(id, parentId, direction),
  target,
})

// A Root; a Branch with a Markdown Leaf and one that isn't, and one shrunk from a Branch; a Branch kept
// as `3-games`, keeping Frontmatter, holding References to a Branch, to a Leaf, and a broken one;
// `.skills`, naming its files `SKILL.md`, with a skill and a Context Tile setting a bare `<slug>`
// folder pattern; and a Context Tile whose Title and Preview hold line breaks.
const rows: ReadonlyArray<TileRow> = [
  { ...row('root', null, null), title: 'Ulysse' },
  { ...row('leadership', 'root', 1), title: 'Leadership' },
  { ...row('notes', 'leadership', 7), title: 'Notes' },
  {
    ...row('json', 'leadership', 8),
    title: 'package.json',
    preview: '',
    body: '{ "name": "x" }\n',
    name: 'package.json',
  },
  { ...row('shrunk', 'leadership', 9), title: 'Shrunk', name: '3-shrunk' },
  {
    ...row('games', 'root', 3),
    title: 'Games',
    name: '3-games',
    frontmatter: { owner: 'diplo', weight: 2, draft: false },
  },
  reference('to-leadership', 'games', -1, 'leadership'),
  reference('to-notes', 'games', -2, 'notes'),
  reference('to-gone', 'games', -3, 'gone'),
  {
    ...row('skills', 'root', 4),
    title: 'Skills',
    name: '.skills',
    config: { fileName: 'SKILL.md' },
  },
  { ...row('do-ticket', 'skills', 1), title: 'Do ticket', name: 'do-ticket' },
  { ...row('rules', 'skills', -1), title: 'Rules', config: { folderPattern: '<slug>' } },
  { ...row('first', 'rules', 2), title: 'Écoles françaises' },
  { ...row('second', 'rules', 1), title: 'Zèbres' },
  { ...row('principles', 'root', -1), title: 'Line one\n---\nid: x', preview: 'a b' },
]

const system = systemOf(rows)
if (system === undefined) throw new Error('These rows hold a Root')

const link = (id: string) => `https://hexframe.test/?center=${id}`
const idOfLink = (url: string) => /\?center=(.+)$/.exec(url)?.[1]

const utf8 = new TextEncoder()

/** The plan an import reads from these files, as a folder. */
function imported(files: ReadonlyArray<File>): PlannedTile {
  const read = importOf(
    {
      _tag: 'Folder',
      name: 'ulysse',
      files: files.map(({ path, content }) => ({ path, bytes: utf8.encode(content) })),
    },
    idOfLink,
  )
  if (Result.isFailure(read)) throw new Error(JSON.stringify(read.failure.faults))
  if (read.success.root._tag !== 'Tile') throw new Error('A folder reads as a Tile')
  return read.success.root
}

/** Whatever a Tile says, by slot, to compare a System's tree with a plan's. */
type Said = Record<string, unknown>

const bySlot = <T, U>(record: Partial<Record<number, T>>, each: (value: T) => U) =>
  Object.fromEntries(
    Object.entries(record).map(([slot, value]) => [slot, each(value as T)]),
  ) as Partial<Record<number, U>>

/** What a Tile says and keeps, a System's or a plan's. */
type Carried = 'title' | 'preview' | 'body' | 'config' | 'frontmatter'

const content = (tile: Pick<LeafTile, Carried> | Pick<PlannedLeaf, Carried>) => ({
  title: tile.title,
  preview: tile.preview,
  body: tile.body,
  config: tile.config,
  frontmatter: tile.frontmatter,
})

/** A System's Tile as it says it: a Reference by its target's Title, a broken one by its link. */
function saidBySystem(tile: SystemTile): Said {
  const held = (value: SystemTile | Reference | BrokenReference): Said => {
    if (value._tag === 'Reference') return { to: value.tile.title }
    return value._tag === 'BrokenReference' ? { linked: value.target } : saidBySystem(value)
  }
  return {
    ...content(tile),
    branches: bySlot(tile.branches, saidBySystem),
    leaves: bySlot(tile.leaves, content),
    context: bySlot(tile.context, held),
  }
}

/** A plan's Tile as it says it, its References found by path among the Tiles it plans. */
function saidByPlan(tile: PlannedTile, titles: ReadonlyMap<string, string>): Said {
  const held = (value: PlannedTile | PlannedReference): Said => {
    if (value._tag === 'Tile') return saidByPlan(value, titles)
    const { target } = value
    if (target._tag === 'Inside') return { to: titles.get(target.path) }
    return target._tag === 'Linked' ? { linked: target.id } : { broken: true }
  }
  return {
    ...content(tile),
    branches: bySlot(tile.branches, (branch) => saidByPlan(branch, titles)),
    leaves: bySlot(tile.leaves, content),
    context: bySlot(tile.context, held),
  }
}

/** The Title of every Tile a plan creates, by its path. */
function titlesIn(tile: PlannedTile): Map<string, string> {
  const titles = new Map([[tile.path, tile.title]])
  for (const leaf of Object.values(tile.leaves)) titles.set(leaf.path, leaf.title)
  for (const below of [...Object.values(tile.branches), ...Object.values(tile.context)]) {
    if (below._tag === 'Tile') for (const entry of titlesIn(below)) titles.set(...entry)
  }
  return titles
}

/** A plan as a System, each Tile's id its path, to export it in turn. */
function systemOfPlan(
  tile: PlannedTile,
  byPath: ReadonlyMap<string, PlannedTile | PlannedLeaf>,
): SystemTile {
  const idOf = (path: string) => path || '.'
  const found = (planned: PlannedTile | PlannedLeaf) => ({
    _tag: 'Tile' as const,
    id: idOf(planned.path),
    ...content(planned),
    ...(planned.name === undefined ? {} : { name: planned.name }),
  })
  const held = (
    value: PlannedTile | PlannedReference,
  ): SystemTile | Reference | BrokenReference => {
    if (value._tag === 'Tile') return systemOfPlan(value, byPath)
    const { target } = value
    const inside = target._tag === 'Inside' ? byPath.get(target.path) : undefined
    if (inside !== undefined) return { _tag: 'Reference', tile: found(inside) }
    return { _tag: 'BrokenReference', target: target._tag === 'Linked' ? target.id : '' }
  }
  return {
    ...found(tile),
    branches: bySlot(tile.branches, (branch) => systemOfPlan(branch, byPath)),
    leaves: bySlot(tile.leaves, found),
    context: bySlot(tile.context, held),
  }
}

/** Every Tile a plan creates, by its path. */
function plannedIn(tile: PlannedTile): Map<string, PlannedTile | PlannedLeaf> {
  const all = new Map<string, PlannedTile | PlannedLeaf>([[tile.path, tile]])
  for (const leaf of Object.values(tile.leaves)) all.set(leaf.path, leaf)
  for (const below of [...Object.values(tile.branches), ...Object.values(tile.context)]) {
    if (below._tag === 'Tile') for (const entry of plannedIn(below)) all.set(...entry)
  }
  return all
}

/** A file's text without its `id` line, which a second export writes anew. */
const withoutId = ({ path, content }: File) => ({
  path,
  content: content.replace(/^id: .*\n/m, ''),
})

describe('a System exported, then imported', () => {
  const files = exportOf(system, 'root', link)?.files ?? []
  const plan = imported(files)

  it('reads back into the same tree: content, slots, configs, Frontmatter and References', () => {
    expect(saidByPlan(plan, titlesIn(plan))).toEqual(saidBySystem(system))
  })

  it('keeps the Names it was written under, so an export writes them again', () => {
    expect(plan.branches[3]).toMatchObject({ name: '3-games' })
    expect(plan.branches[1]?.leaves[2]).toMatchObject({
      name: 'package.json',
      body: '{ "name": "x" }\n',
    })
    expect(plan.branches[1]?.leaves[3]).toMatchObject({ name: '3-shrunk.md', title: 'Shrunk' })
    expect(plan.branches[4]).toMatchObject({ config: { fileName: 'SKILL.md' } })
  })

  it('writes the same files once exported in turn, but for their ids', () => {
    const again = exportOf(systemOfPlan(plan, plannedIn(plan)), '.', link)?.files ?? []
    const sorted = (all: ReadonlyArray<File>) =>
      all.map(withoutId).sort((a, b) => a.path.localeCompare(b.path))
    expect(sorted(again)).toEqual(sorted(files))
  })
})

describe('a Tile exported with what is below it, then imported', () => {
  it('reads back with the naming it inherits, a Reference to a Tile left out by its link', () => {
    const games = imported(exportOf(system, 'games', link)?.files ?? [])
    expect(games.context[-1]).toMatchObject({ target: { _tag: 'Linked', id: 'leadership' } })
    const skill = imported(exportOf(system, 'do-ticket', link)?.files ?? [])
    expect(skill).toMatchObject({ title: 'Do ticket', config: { fileName: 'SKILL.md' } })
  })
})
