// The vault's files through Node, by full path: what is at a path, the read made by the real path
// just checked, and the one write. `disk.ts` puts Obsidian's paths on them; this file imports no
// Obsidian, so it is tested against a real folder.
import { randomBytes } from 'node:crypto'
import { constants } from 'node:fs'
import { lstat, mkdir, open, realpath, rename, rm, stat } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

import { readLimit, type FileStat } from '../../../2-claude-mod/hooks/shape/node.ts'

/**
 * What is at `fullPath` on disk, every symlink followed, or undefined when nothing is there. Its
 * real path is written with `/`, Windows' included, as the shape compares paths. A symlink that
 * leads nowhere is something: `other`, with no real path, which the shape's `unreadable` refuses,
 * so nothing is read or written through it as if the path were free.
 */
export async function statAt(fullPath: string): Promise<FileStat | undefined> {
  try {
    const [found, realPath] = await Promise.all([stat(fullPath), realpath(fullPath)])
    const kind = found.isFile() ? 'file' : found.isDirectory() ? 'dir' : 'other'
    return { kind, size: found.size, realPath: realPath.replaceAll('\\', '/') }
  } catch (error) {
    if (!isMissing(error)) throw error
    // `stat` finds nothing past a dangling symlink; `lstat` sees the symlink itself.
    const link = await lstat(fullPath).catch((missed: unknown) => {
      if (isMissing(missed)) return undefined
      throw missed
    })
    return link === undefined ? undefined : { kind: 'other', size: 0 }
  }
}

/** Node's flags as this platform has them: Windows has no `O_NOFOLLOW` nor `O_NONBLOCK`. */
const platform: Partial<typeof constants> = constants

/**
 * The text of the file at `realPath`, opened once and held to the shape's rules on that one handle:
 * a regular file of at most the read limit, and never more read than that. The open follows no
 * symlink and doesn't wait on a pipe, where the platform has the flags for it, so a file swapped in
 * since its check is refused, not read. Windows has neither, so there the handle is also matched
 * against what sits at `realPath` itself, not following it: a symlink swapped in there is another
 * file than the one the open reached, and is refused too.
 */
export async function readChecked(realPath: string): Promise<string> {
  const flags = constants.O_RDONLY | (platform.O_NOFOLLOW ?? 0) | (platform.O_NONBLOCK ?? 0)
  const handle = await open(realPath, flags)
  try {
    const [found, there] = await Promise.all([
      handle.stat({ bigint: true }),
      lstat(realPath, { bigint: true }),
    ])
    if (found.dev !== there.dev || found.ino !== there.ino) {
      throw new Error('it changed since it was checked')
    }
    if (!found.isFile()) throw new Error('it is not a file')
    if (found.size > readLimit) throw new Error('it is too large')
    const size = Number(found.size)
    const buffer = Buffer.alloc(size)
    const { bytesRead } = await handle.read(buffer, 0, size, 0)
    return buffer.subarray(0, bytesRead).toString('utf8')
  } finally {
    await handle.close()
  }
}

/**
 * Writes `text` at `fullPath`, making the folder holding it when missing, as a `.hexframe/` is the
 * first time a folder leaves something out. A folder already there, a dangling symlink included,
 * is never made again. The text goes to a new file beside it first, created only where nothing is,
 * a symlink included, then renamed over `fullPath`: a write that fails or falls short leaves the
 * file as it was, and the new file is removed. The rename replaces what is at `fullPath` rather
 * than following it, so a symlink there, a dangling one included, is replaced, never written
 * through, and a folder there is refused. None of it needs `O_NOFOLLOW`, so it holds on Windows.
 */
export async function replaceFile(fullPath: string, text: string): Promise<void> {
  const folder = dirname(fullPath)
  await mkdir(folder).catch((error: unknown) => {
    if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error
  })
  const temporary = join(folder, `.${basename(fullPath)}.${randomBytes(6).toString('hex')}.tmp`)
  const flags = constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL
  const handle = await open(temporary, flags, 0o644)
  try {
    try {
      await handle.writeFile(text, 'utf8')
      await handle.sync()
    } finally {
      await handle.close()
    }
    await rename(temporary, fullPath)
  } catch (error) {
    // The write's own failure is what to report, not a failure to clean up after it.
    await rm(temporary, { force: true }).catch(() => undefined)
    throw error
  }
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}
