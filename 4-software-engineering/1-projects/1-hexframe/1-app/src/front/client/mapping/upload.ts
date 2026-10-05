// The browser's side of an import: what the user gave, a folder (picked or dropped), a zip or one
// file, made into the upload `importTiles` takes, before a byte is sent. By Mapping's rules, which
// `api/mapping/files/upload.ts` offers it: it leaves out what Mapping's reading would (`leftOutOf`,
// `skippedAsBinary`), unwraps a zip's one wrapping folder (`wrappingFolder`), checks the bounds the
// server unpacks within, its verdict on every path and the 4 MB it takes (`pastBounds`, `pathFaults`,
// `stoppedAt`, `uploadFaults`), and zips what is left through the zip repository's plain functions.
// It only prunes and warns early: the server reads and checks everything again.
import {
  type ArchiveEntry,
  archiveBounds,
  archived,
  type ImportRefused,
  isSettingsFile,
  type LeftOut,
  leftOutOf,
  pastBounds,
  pathFaults,
  skippedAsBinary,
  stoppedAt,
  unpacked,
  uploadFaults,
  wrappingFolder,
} from '#/api/mapping/files/upload'

export type { LeftOut }

/** One file of a folder the user gave: its path from the folder, `/` between folders, read when asked. */
export interface GivenFile {
  readonly path: string
  /** Only an archive holds a symlink, which the server refuses. */
  readonly kind: 'File' | 'Symlink'
  readonly blob: () => Promise<Blob>
}

/** What the user gave: a folder, by its name and its files, a zip of one, or one file alone. */
export type Given =
  | { readonly _tag: 'Folder'; readonly name: string; readonly files: ReadonlyArray<GivenFile> }
  | { readonly _tag: 'Zip'; readonly file: File }
  | { readonly _tag: 'File'; readonly file: File }

/** Every fault of an import refused before it is sent, at least one, as the server would list them. */
type Faults = ImportRefused['faults']

/**
 * What the browser sends, as `importTiles`'s form takes it, with what it left out; or why the server
 * would refuse it, so nothing is sent.
 */
export type Prepared =
  | {
      readonly _tag: 'Ready'
      readonly upload: File
      readonly as: 'Zip' | 'File'
      readonly leftOut: ReadonlyArray<LeftOut>
    }
  | { readonly _tag: 'Refused'; readonly faults: Faults; readonly leftOut: ReadonlyArray<LeftOut> }

/**
 * What the browser unpacks a zip the user gave within, before leaving anything out: far past what the
 * server takes, so a vault zipped with its `node_modules` still reads, and bounded only so the
 * browser's memory is.
 */
const givenBounds = { entries: 100_000, entryBytes: 256_000_000, totalBytes: 256_000_000 }

/** How much of a file past the shape's 1 MB is read, to tell a binary, left out, from a text, refused. */
const headBytes = 8_192

const tooLarge: Faults = [{ path: '', fault: 'UploadTooLarge' }]

const bytesOf = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer())

/** Refused with these faults, when there are any. */
function refusedFor(
  faults: ReadonlyArray<Faults[number]>,
  leftOut: ReadonlyArray<LeftOut>,
): Prepared | undefined {
  const [first, ...rest] = faults
  return first === undefined ? undefined : { _tag: 'Refused', faults: [first, ...rest], leftOut }
}

/** One file alone, sent as it is: refused past 4 MB, or past the shape's 1 MB. */
function single(file: File): Prepared {
  const tooLargeFile = uploadFaults(file.size)
  const faults =
    tooLargeFile.length > 0 ? tooLargeFile : pastBounds([{ path: file.name, size: file.size }])
  return refusedFor(faults, []) ?? { _tag: 'Ready', upload: file, as: 'File', leftOut: [] }
}

/** A file of a folder, read: whole, or only its head past the shape's 1 MB; a binary is left out. */
async function readOf({ path, kind, blob }: GivenFile) {
  if (kind === 'Symlink') return { path, kind, size: 0, bytes: new Uint8Array(), binary: false }
  const whole = await blob()
  const head = whole.size > archiveBounds.entryBytes
  const bytes = await bytesOf(head ? whole.slice(0, headBytes) : whole)
  return { path, kind, size: whole.size, bytes, binary: skippedAsBinary(path, bytes, head) }
}

/**
 * The kept files read one at a time, each binary left out as it is told. Reading stops once the texts
 * pass what the server unpacks, in count or in bytes, since the bounds refuse them whatever follows,
 * so a large folder is never read whole.
 */
async function textsOf(kept: ReadonlyArray<GivenFile>, leftOut: Array<LeftOut>) {
  const texts: Array<Awaited<ReturnType<typeof readOf>>> = []
  let total = 0
  for (const file of kept) {
    if (texts.length > archiveBounds.entries || total > archiveBounds.totalBytes) break
    // One file at a time: what is read so far decides whether to read on.
    const read = await readOf(file)
    if (read.binary) leftOut.push({ path: read.path, reason: 'Binary' })
    else {
      texts.push(read)
      total += read.size
    }
  }
  return texts
}

/**
 * A folder's files, without what a reading leaves out, checked against the bounds the server unpacks
 * within and its verdict on every path, then zipped, at most 4 MB, named by the folder. With
 * `unwrap`, a zip's files that all sit in one folder are that folder's, named by it.
 */
async function folder(
  given: string,
  files: ReadonlyArray<GivenFile>,
  { unwrap = false } = {},
): Promise<Prepared> {
  const settings = new Map(
    await Promise.all(
      files
        .filter(({ path, kind }) => kind === 'File' && isSettingsFile(path))
        .map(async ({ path, blob }) => [path, await bytesOf(await blob())] as const),
    ),
  )
  const { kept, leftOut } = leftOutOf(files, settings)
  const texts = await textsOf(kept, leftOut)
  const wrapper = unwrap ? wrappingFolder(texts) : undefined
  const name = wrapper ?? given
  // Every path the report lists reads from the folder sent, the wrapper's own left-out ones included.
  if (wrapper !== undefined) {
    for (const [index, { path, reason }] of leftOut.entries()) {
      if (path.startsWith(`${wrapper}/`))
        leftOut[index] = { path: path.slice(wrapper.length + 1), reason }
    }
  }
  const sent =
    wrapper === undefined
      ? texts
      : texts.map((file) => ({ ...file, path: file.path.slice(wrapper.length + 1) }))
  const past = refusedFor(pastBounds(sent), leftOut)
  if (past !== undefined) return past
  const entries: ReadonlyArray<ArchiveEntry> = sent.map(({ path, kind, bytes }) => ({
    path,
    kind,
    bytes,
  }))
  const refused = refusedFor(pathFaults(entries), leftOut)
  if (refused !== undefined) return refused
  // The verdict on the paths refuses a symlink: every entry left is a file.
  const archive = archived(entries)
  const tooLargeArchive = refusedFor(uploadFaults(archive.length), leftOut)
  if (tooLargeArchive !== undefined) return tooLargeArchive
  const upload = new File([archive.slice()], `${name}.zip`, { type: 'application/zip' })
  return { _tag: 'Ready', upload, as: 'Zip', leftOut }
}

/**
 * A zip the user gave, unpacked in the browser and sent as the folder it holds, named by it, `.zip`
 * dropped, once pruned: refused where it can't be unpacked, as the server would refuse it.
 */
async function unzippedOf(file: File): Promise<Prepared> {
  if (file.size > givenBounds.totalBytes) return { _tag: 'Refused', faults: tooLarge, leftOut: [] }
  const opened = unpacked(await bytesOf(file), givenBounds)
  if (opened._tag !== 'Unpacked')
    return { _tag: 'Refused', faults: [stoppedAt(opened)], leftOut: [] }
  const files = opened.entries.flatMap(({ path, kind, bytes }): Array<GivenFile> =>
    kind === 'Folder'
      ? []
      : [{ path, kind, blob: () => Promise.resolve(new Blob([bytes.slice()])) }],
  )
  return folder(file.name.replace(/\.zip$/i, ''), files, { unwrap: true })
}

/**
 * What the browser sends of what the user gave: a folder or a zip pruned of what the server would
 * leave out, and zipped; one file as it is; or why the server would refuse it, every fault at once,
 * so nothing is sent. What was left out is listed either way.
 */
export function prepared(given: Given): Promise<Prepared> {
  switch (given._tag) {
    case 'File':
      return Promise.resolve(single(given.file))
    case 'Zip':
      return unzippedOf(given.file)
    case 'Folder':
      return folder(given.name, given.files)
  }
}
