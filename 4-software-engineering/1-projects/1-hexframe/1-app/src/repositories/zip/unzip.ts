// A zip archive a user sends, unpacked in memory, never onto a disk: its central directory read here,
// each entry inflated through fflate's streaming `Inflate`, a little at a time, its bytes counted as
// they come out rather than taken from the headers, which are the sender's to write. It stops the
// moment an entry or the whole passes the bounds its caller gives. It says what each entry is, its
// path as written, a file, a folder or a symlink, and its bytes, and normalizes nothing: what a path
// may be is Mapping's to say (src/domains/mapping/).
import { Inflate } from 'fflate'

/** What an entry of an archive is, as its header says. */
type EntryKind = 'File' | 'Folder' | 'Symlink'

/** One entry of an archive: its path as written, what it is, and its bytes, none but a file's. */
export interface ArchiveEntry {
  readonly path: string
  readonly kind: EntryKind
  readonly bytes: Uint8Array
}

/** The most an unpacking takes: entries, bytes inflated for one entry, and bytes for all of them. */
export interface UnpackBounds {
  readonly entries: number
  readonly entryBytes: number
  readonly totalBytes: number
}

/**
 * An archive unpacked, or where it stopped: more entries than the bounds take (before inflating any),
 * an entry inflating past its bound, the whole past its own (at the entry it was inflating), or an
 * archive that can't be read (no zip, encrypted, zip64, an unknown method, corrupt data).
 */
export type Unpacked =
  | { readonly _tag: 'Unpacked'; readonly entries: ReadonlyArray<ArchiveEntry> }
  | { readonly _tag: 'TooManyEntries' }
  | { readonly _tag: 'EntryTooLarge'; readonly path: string }
  | { readonly _tag: 'TotalTooLarge'; readonly path: string }
  | { readonly _tag: 'Unreadable' }

/** An archive that can't be read: thrown inside this module only, and answered as `Unreadable`. */
class Unreadable extends Error {}

/** A bound passed while inflating an entry: thrown inside this module only. */
class PastBound extends Error {
  constructor(readonly bound: 'EntryTooLarge' | 'TotalTooLarge') {
    super(bound)
  }
}

const signatures = { local: 0x04034b50, central: 0x02014b50, end: 0x06054b50 } as const

/** The end record's size, without its comment, and the most a comment adds. */
const endSize = 22
const commentMost = 0xffff

/** How many compressed bytes each push hands the inflater: what one push can inflate is bounded. */
const slice = 1_024

/** A field the format marks as moved to a zip64 record, which this reader doesn't follow. */
const zip64 = { count: 0xffff, size: 0xffffffff } as const

/** The bits of the general purpose flag: an encrypted entry, a name in UTF-8. */
const flags = { encrypted: 0x1, utf8: 0x800 } as const

/** Where an entry was made, by the high byte of "version made by": Unix and macOS keep its mode. */
const unixHosts: ReadonlyArray<number> = [3, 19]

/** A Unix mode's file type: a symlink, a folder. */
const modes = { type: 0o170000, symlink: 0o120000, folder: 0o040000 } as const

/** MS-DOS's folder attribute. */
const dosFolder = 0x10

const methods = { stored: 0, deflated: 8 } as const

/** The little-endian reader of an archive's bytes, every read inside them or `Unreadable`. */
function readerOf(archive: Uint8Array) {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength)
  const inside = (at: number, length: number) => {
    if (at < 0 || at + length > archive.length) throw new Unreadable()
  }
  return {
    u16: (at: number) => {
      inside(at, 2)
      return view.getUint16(at, true)
    },
    u32: (at: number) => {
      inside(at, 4)
      return view.getUint32(at, true)
    },
    bytes: (at: number, length: number) => {
      inside(at, length)
      return archive.subarray(at, at + length)
    },
  }
}

type Reader = ReturnType<typeof readerOf>

/** Where the end record starts: the last signature that leaves room for its comment. */
function endOf(archive: Uint8Array, read: Reader): number {
  const lowest = Math.max(0, archive.length - endSize - commentMost)
  for (let at = archive.length - endSize; at >= lowest; at--) {
    if (read.u32(at) === signatures.end && at + endSize + read.u16(at + 20) === archive.length) {
      return at
    }
  }
  throw new Unreadable()
}

const utf8 = new TextDecoder('utf-8', { fatal: true })
const latin1 = new TextDecoder('latin1')

/** A name as written: UTF-8 when flagged or when it reads as UTF-8, else one character per byte. */
function nameOf(bytes: Uint8Array, flagged: boolean): string {
  try {
    return utf8.decode(bytes)
  } catch {
    if (flagged) throw new Unreadable()
    return latin1.decode(bytes)
  }
}

/** What an entry of the central directory says about one entry. */
interface Header {
  readonly path: string
  readonly kind: EntryKind
  readonly method: number
  readonly compressedSize: number
  readonly localAt: number
}

/** What an entry is: a symlink or a folder by its mode or its attributes, a folder by its `/`. */
function kindOf(path: string, { host, attributes }: { host: number; attributes: number }) {
  const mode = unixHosts.includes(host) ? (attributes >>> 16) & modes.type : 0
  if (mode === modes.symlink) return 'Symlink'
  if (mode === modes.folder || path.endsWith('/') || (attributes & dosFolder) !== 0) return 'Folder'
  return 'File'
}

/** The headers of the central directory, in its order: at most `count`, which the end record gives. */
function headersOf(read: Reader, { at, count }: { at: number; count: number }) {
  const headers: Array<Header> = []
  let next = at
  for (let index = 0; index < count; index++) {
    if (read.u32(next) !== signatures.central) throw new Unreadable()
    const flag = read.u16(next + 8)
    const compressedSize = read.u32(next + 20)
    const nameLength = read.u16(next + 28)
    const localAt = read.u32(next + 42)
    if ((flag & flags.encrypted) !== 0) throw new Unreadable()
    if (compressedSize === zip64.size || localAt === zip64.size) throw new Unreadable()
    const path = nameOf(read.bytes(next + 46, nameLength), (flag & flags.utf8) !== 0)
    const host = read.u16(next + 4) >>> 8
    const attributes = read.u32(next + 38)
    headers.push({
      path,
      kind: kindOf(path, { host, attributes }),
      method: read.u16(next + 10),
      compressedSize,
      localAt,
    })
    next += 46 + nameLength + read.u16(next + 30) + read.u16(next + 32)
  }
  return headers
}

/** An entry's compressed bytes, past its local header, as long as the central directory says. */
function dataOf(read: Reader, { localAt, compressedSize }: Header): Uint8Array {
  if (read.u32(localAt) !== signatures.local) throw new Unreadable()
  const start = localAt + 30 + read.u16(localAt + 26) + read.u16(localAt + 28)
  return read.bytes(start, compressedSize)
}

/** The bytes unpacked so far, which every entry's count adds to. */
interface Tally {
  total: number
}

/**
 * An entry's bytes, inflated a slice at a time and counted as they come out: the first slice that
 * takes it past its bound, or the whole past its own, stops it.
 */
function inflated(data: Uint8Array, method: number, { bounds, tally }: Counting): Uint8Array {
  const chunks: Array<Uint8Array> = []
  let size = 0
  const take = (chunk: Uint8Array) => {
    size += chunk.length
    tally.total += chunk.length
    if (size > bounds.entryBytes) throw new PastBound('EntryTooLarge')
    if (tally.total > bounds.totalBytes) throw new PastBound('TotalTooLarge')
    chunks.push(chunk)
  }
  if (method === methods.stored) take(data)
  else if (method === methods.deflated) {
    const inflater = new Inflate(take)
    for (let at = 0; at < data.length; at += slice) {
      inflater.push(data.subarray(at, at + slice), at + slice >= data.length)
    }
    if (data.length === 0) inflater.push(data, true)
  } else throw new Unreadable()
  const bytes = new Uint8Array(size)
  let at = 0
  for (const chunk of chunks) {
    bytes.set(chunk, at)
    at += chunk.length
  }
  return bytes
}

/** What an unpacking counts against. */
interface Counting {
  readonly bounds: UnpackBounds
  readonly tally: Tally
}

/** An entry read: a file's bytes inflated, a folder's or a symlink's left alone. */
function entryOf(read: Reader, header: Header, counting: Counting): ArchiveEntry {
  const { path, kind } = header
  if (kind !== 'File') return { path, kind, bytes: new Uint8Array() }
  try {
    return { path, kind, bytes: inflated(dataOf(read, header), header.method, counting) }
  } catch (error) {
    if (error instanceof PastBound || error instanceof Unreadable) throw error
    // fflate throws on data that doesn't inflate.
    throw new Unreadable()
  }
}

/**
 * An archive's entries, in the order its central directory lists them, each file's bytes inflated
 * and counted as they come out; or where the bounds stopped it, or `Unreadable`. Nothing touches a
 * disk, and a path is answered as written.
 */
export function unpacked(archive: Uint8Array, bounds: UnpackBounds): Unpacked {
  let current = ''
  try {
    const read = readerOf(archive)
    const end = endOf(archive, read)
    const count = read.u16(end + 10)
    const at = read.u32(end + 16)
    if (count === zip64.count || at === zip64.size) return { _tag: 'Unreadable' }
    if (count > bounds.entries) return { _tag: 'TooManyEntries' }
    const counting = { bounds, tally: { total: 0 } }
    const entries = headersOf(read, { at, count }).map((header) => {
      current = header.path
      return entryOf(read, header, counting)
    })
    return { _tag: 'Unpacked', entries }
  } catch (error) {
    if (error instanceof PastBound) return { _tag: error.bound, path: current }
    if (error instanceof Unreadable) return { _tag: 'Unreadable' }
    throw error
  }
}
