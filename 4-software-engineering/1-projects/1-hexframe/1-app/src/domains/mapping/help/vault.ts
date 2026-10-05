// A vault folder read as a System's rows, in the shape a System exports to: a folder per Tile,
// `<n>-<slug>/` for a Child in Direction n and `.<n>-<slug>/` for a Tile of its Context in slot -n,
// each with a note, a `CLAUDE.md` or its twin in another language, whose frontmatter holds the Tile's
// Title and Preview and whose rest is its Body. Pure: the notes come in as text, from whoever read or
// bundled them. Help holds its notes to more than an import does, every field written and every folder
// numbered, and says what keeps a folder from reading as a Tile, named; the notes that pass are then
// read the way an import reads files (`files/import/`), the app's one reader of a vault folder, each
// language's note in the place of the folder's `CLAUDE.md`, so every language reads alike.
import { missingFrom, noteOf } from '#/repositories/help/note'
import { Result } from 'effect'

import { importOf } from '../files/import/read'
import type { PlannedTile } from '../files/import/plan'
import { directions, fitsPreview, keepsNothing, previewLimit, type Row } from '../entities'

/** A folder's name, `3-children` or `.1-six-at-most`: a Child's Direction, or a Context slot. */
const folderName = new RegExp(`^(\\.?)(${directions.join('|')})-[a-z0-9]+(?:-[a-z0-9]+)*$`)

/** The slot a folder's name stands in, `undefined` for a name that stands in none. */
function slotOf(name: string): number | undefined {
  const match = folderName.exec(name)
  if (match === null) return undefined
  const direction = Number(match[2])
  return match[1] === '.' ? -direction : direction
}

/** A folder's note, named `file`, when Help reads it; else what keeps it from being a Tile's. */
function noteChecked(
  text: string | undefined,
  file: string,
): { readonly text: string } | { readonly problem: string } {
  if (text === undefined) return { problem: `no ${file}` }
  const note = noteOf(text)
  if (note === undefined) return { problem: `its ${file} opens with no frontmatter` }
  const { title = '', preview = '' } = note.fields
  // A Tile has a Title, as Mapping requires of every Tile, and a Tile of Help a Preview, since a
  // reader opens Help by its Previews; the vault's own fields are the repository's to name.
  const missing = [
    ...(title.trim() === '' ? ['title'] : []),
    ...missingFrom(note),
    ...(preview.trim() === '' ? ['preview'] : []),
  ]
  if (missing.length > 0) return { problem: `its ${file} has no ${missing.join(', ')}` }
  if (!fitsPreview(preview)) {
    return { problem: `its ${file} has a Preview over ${String(previewLimit)} characters` }
  }
  return { text }
}

/** A vault folder read: the rows of its Tiles, and what kept any of its folders from being one. */
export interface Vault {
  readonly rows: ReadonlyArray<Row>
  readonly problems: ReadonlyArray<string>
}

/** Where a planned Tile stands among the rows: its id, its parent's, its slot. */
type Place = Pick<Row, 'id' | 'parentId' | 'direction'>

/**
 * The rows of a planned Tile and of the Tiles below it, Context first, each id its parent's and the
 * slot the import seated it in, but for the folders whose note Help refused, which `read` leaves out:
 * they read as no Tile.
 */
function rowsOf(tile: PlannedTile, place: Place, read: ReadonlySet<string>): Array<Row> {
  const below = (slot: string): Place => ({
    id: `${place.id}/${slot}`,
    parentId: place.id,
    direction: Number(slot),
  })
  const own: Array<Row> = read.has(tile.path)
    ? [
        {
          ...place,
          target: null,
          title: tile.title,
          preview: tile.preview,
          body: tile.body.trim(),
          ...keepsNothing,
        },
      ]
    : []
  return [
    ...own,
    ...Object.entries(tile.context).flatMap(([slot, held]) =>
      held._tag === 'Tile' ? rowsOf(held, below(slot), read) : [],
    ),
    ...Object.entries(tile.branches).flatMap(([slot, branch]) => rowsOf(branch, below(slot), read)),
  ]
}

/** The folder a fault's path names: a folder's own, or the one whose note it is (`noteAt`). */
const folderOf = (path: string) => path.replace(/(^|\/)CLAUDE\.md$/, '')

/**
 * The id a folder's name gives it in Help, the path of its slots from `root`; none for a name that is
 * no slot. Help's own rule, so no two of its folders claim one slot; the import seats them alike.
 */
function idOf(root: string, path: string): string | undefined {
  const slots = path === '' ? [] : path.split('/').map(slotOf)
  return slots.every((slot) => slot !== undefined) ? [root, ...slots].join('/') : undefined
}

/**
 * The notes Help reads, by their folder's path, those that pass its rules and stand each in a slot of
 * its own, the first in path order keeping it; and what keeps each other folder from reading as a Tile.
 */
function notesRead(
  root: string,
  { notes, file }: { notes: Readonly<Record<string, string | undefined>>; file: string },
) {
  const problems: string[] = []
  const refuse = (path: string, why: string) => problems.push(`${path || '.'}: ${why}`)
  const read = new Map<string, string>()
  const ids = new Set<string>()
  for (const path of Object.keys(notes).sort()) {
    const id = idOf(root, path)
    const note = noteChecked(notes[path], file)
    if (id === undefined)
      refuse(path, 'a folder is named <n>-<slug> for a Child, .<n>-<slug> for Context')
    else if ('problem' in note) refuse(path, note.problem)
    else if (ids.has(id)) refuse(path, 'another folder already stands in its slot')
    else {
      ids.add(id)
      read.set(path, note.text)
    }
  }
  return { read, problems }
}

const utf8 = new TextEncoder()

/** The note of each folder handed to the reader, as an import reads it: its folder's `CLAUDE.md`. */
const noteAt = (path: string) => (path === '' ? 'CLAUDE.md' : `${path}/CLAUDE.md`)

/**
 * The rows the notes Help reads give, read as an import reads the files of a folder, each note in the
 * place of its folder's `CLAUDE.md`; none, with the faults the reading found, each on its folder, when
 * it refuses them.
 */
function rowsRead(
  root: string,
  { read, file }: { read: ReadonlyMap<string, string>; file: string },
): { rows: ReadonlyArray<Row> | undefined; problems: ReadonlyArray<string> } {
  const files = [...read].map(([path, text]) => ({ path: noteAt(path), bytes: utf8.encode(text) }))
  const plan = importOf({ _tag: 'Folder', name: root, files }, () => undefined)
  if (Result.isFailure(plan)) {
    return {
      rows: undefined,
      problems: plan.failure.faults.map(
        ({ path, fault }) => `${folderOf(path) || '.'}: its ${file} reads as no Tile: ${fault}`,
      ),
    }
  }
  const { root: tile } = plan.success
  const place = { id: root, parentId: null, direction: null }
  return {
    rows: tile._tag === 'Tile' ? rowsOf(tile, place, new Set(read.keys())) : [],
    problems: [],
  }
}

/**
 * The Tiles of a vault folder whose Root has the id `root`, from the note of each of its folders, a
 * file named `file` (`CLAUDE.md`, or a language's twin, `CLAUDE.fr.md`), keyed by the folder's path
 * from the vault folder (`''` for the Root itself, `3-children/.1-six-at-most` below it), `undefined`
 * for a folder that has none. A Tile's id is the path of slots from the Root, `root`, `root/3`,
 * `root/3/-1`, whatever the language its notes are written in.
 */
export function vaultOf(
  root: string,
  notes: Readonly<Record<string, string | undefined>>,
  file: string,
): Vault {
  const checked = notesRead(root, { notes, file })
  const read = rowsRead(root, { read: checked.read, file })
  if (read.rows === undefined)
    return { rows: [], problems: [...checked.problems, ...read.problems] }
  const { rows } = read
  const ids = new Set(rows.map(({ id }) => id))
  const orphans = rows.filter(({ parentId }) => parentId !== null && !ids.has(parentId))
  return {
    rows,
    problems: [
      ...checked.problems,
      ...(ids.has(root) ? [] : ['.: the Root reads as no Tile']),
      ...orphans.map(({ id }) => `${id}: the folder above it reads as no Tile`),
    ],
  }
}
