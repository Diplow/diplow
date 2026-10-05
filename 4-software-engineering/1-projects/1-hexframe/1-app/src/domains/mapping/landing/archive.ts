// What an import takes from an archive: its bounds, which the zip repository counts as it inflates,
// and the verdict on the entries it unpacked, their paths as the archive wrote them. A path that isn't
// plain, a symlink, an entry deeper than an import goes, and two paths a case-blind disk would take
// for one are faults, each on its path, all at once; nothing is normalized to make them pass. Pure:
// the files of a folder for `importOf`, or `ImportRefused`.
import { Effect, Result } from 'effect'

import type { ArchiveEntry, UnpackBounds, Unpacked } from '#/repositories/zip/unzip'

import { type ImportFault, ImportRefused } from '../errors'
import type { ImportSource } from '../files/import/plan'
import { depthLimit } from '../files/import/read'
import { fileLimit } from '../files/import/shape'

/**
 * The most an archive unpacks to: 2,000 entries, each file at most the shape's 1 MB, 16 MB in all, so
 * a small upload can't unpack into a large one, nor into a huge transaction.
 */
export const archiveBounds: UnpackBounds = {
  entries: 2_000,
  entryBytes: fileLimit,
  totalBytes: 16_000_000,
}

/**
 * The faults of a folder's files against the bounds an archive unpacks within, as a sender checks
 * them before it zips the files, by their sizes: more files than an archive may hold, each file past
 * the shape's 1 MB, and the file at which the whole passes 16 MB. None when the files fit.
 */
export function pastBounds(
  files: ReadonlyArray<{ readonly path: string; readonly size: number }>,
): Array<ImportFault> {
  if (files.length > archiveBounds.entries) return [{ path: '', fault: 'TooManyEntries' }]
  const faults: Array<ImportFault> = []
  let total = 0
  for (const { path, size } of files) {
    if (size > archiveBounds.entryBytes) faults.push({ path, fault: 'FileTooLarge' })
    const before = total
    total += size
    if (before <= archiveBounds.totalBytes && total > archiveBounds.totalBytes) {
      faults.push({ path, fault: 'UnpackedTooLarge' })
    }
  }
  return faults
}

/**
 * The most an import uploads, in bytes: 4 MB, below the 4.5 MB to which Vercel caps a request's body.
 * A larger import goes through storage first, later.
 */
export const uploadLimit = 4_000_000

/**
 * Refuses an upload past 4 MB, by its size alone, before a byte of it is read: `ImportRefused`, its
 * fault `UploadTooLarge` on the upload itself.
 */
export const fitsUpload = (size: number) =>
  size > uploadLimit
    ? Effect.fail(
        new ImportRefused({ fields: ['files'], faults: [{ path: '', fault: 'UploadTooLarge' }] }),
      )
    : Effect.void

/** What an upload is, as its sender says: an archive of a folder, or one file alone. */
export interface Upload {
  readonly as: 'Zip' | 'File'
  /** The upload's file name: the folder's, `.zip` dropped, or the file's own. */
  readonly name: string
  readonly bytes: Uint8Array
}

type Fault = ImportFault['fault']

/** Why an archive stopped unpacking, as a fault of the import. */
const stopped: Record<Exclude<Unpacked['_tag'], 'Unpacked'>, Fault> = {
  TooManyEntries: 'TooManyEntries',
  EntryTooLarge: 'FileTooLarge',
  TotalTooLarge: 'UnpackedTooLarge',
  Unreadable: 'ArchiveUnreadable',
}

/** An entry's path without the `/` a folder's ends with. */
const pathOf = ({ path, kind }: ArchiveEntry) =>
  kind === 'Folder' && path.endsWith('/') ? path.slice(0, -1) : path

/**
 * What is wrong with a path, if anything: absolute, a drive's (`C:`), holding a backslash, a `.` or
 * `..` segment, or not as it would read once normalized, an empty segment or a character Unicode
 * writes another way.
 */
export function pathFault(path: string): Fault | undefined {
  if (path.startsWith('/')) return 'PathAbsolute'
  if (/^[A-Za-z]:/.test(path)) return 'DrivePrefix'
  if (path.includes('\\')) return 'Backslash'
  const segments = path.split('/')
  if (segments.some((segment) => segment === '.' || segment === '..')) return 'DotSegment'
  if (segments.includes('') || path.normalize('NFC') !== path) return 'PathNotNormal'
  return undefined
}

/** What an entry is to a disk that ignores case: its path, a folder or not, an entry's own or not. */
interface Seen {
  readonly path: string
  readonly folder: boolean
  readonly entry: boolean
}

/**
 * Whether an entry clashes with one before it: its path, or a folder above it, equal to one already
 * seen but for case, a file where a folder was or the other way round, or the same entry twice. A
 * folder above an entry may be met any number of times; a later entry is the one at fault.
 */
function clashes(seen: Map<string, Seen>, entry: ArchiveEntry, path: string): boolean {
  const segments = path.split('/')
  for (let length = 1; length <= segments.length; length++) {
    const own = length === segments.length
    const at = segments.slice(0, length).join('/')
    const now = { path: at, folder: !own || entry.kind === 'Folder', entry: own }
    const before = seen.get(at.toLowerCase())
    if (before === undefined) seen.set(at.toLowerCase(), now)
    else if (before.path !== at || before.folder !== now.folder || (own && before.entry)) {
      return true
    } else if (own) seen.set(at.toLowerCase(), now)
  }
  return false
}

/** Every fault of an archive's entries, in their order, one per entry at most. */
function entryFaults(entries: ReadonlyArray<ArchiveEntry>): Array<ImportFault> {
  const faults: Array<ImportFault> = []
  const seen = new Map<string, Seen>()
  for (const entry of entries) {
    const path = pathOf(entry)
    const folders = path.split('/').length - (entry.kind === 'Folder' ? 0 : 1)
    const fault =
      entry.kind === 'Symlink'
        ? 'Symlink'
        : (pathFault(path) ??
          (folders > depthLimit
            ? 'TooDeep'
            : clashes(seen, entry, path)
              ? 'PathsClash'
              : undefined))
    if (fault !== undefined) faults.push({ path: entry.path, fault })
  }
  return faults
}

const refused = ([first, ...rest]: readonly [ImportFault, ...Array<ImportFault>]) =>
  new ImportRefused({ fields: ['files'], faults: [first, ...rest] })

/**
 * The folder an archive holds, named by the upload, `.zip` dropped, its files at the archive's root,
 * as an export writes them: or `ImportRefused` with where it stopped unpacking, or every entry at
 * fault. A folder's own entry adds nothing: a folder is there when a file is below it.
 */
export function folderOf(
  name: string,
  unpacked: Unpacked,
): Result.Result<ImportSource, ImportRefused> {
  if (unpacked._tag !== 'Unpacked') {
    const path = 'path' in unpacked ? unpacked.path : ''
    return Result.fail(refused([{ path, fault: stopped[unpacked._tag] }]))
  }
  const [first, ...rest] = entryFaults(unpacked.entries)
  if (first !== undefined) return Result.fail(refused([first, ...rest]))
  const files = unpacked.entries.flatMap(({ path, kind, bytes }) =>
    kind === 'File' ? [{ path, bytes }] : [],
  )
  return Result.succeed({ _tag: 'Folder', name: name.replace(/\.zip$/i, ''), files })
}
