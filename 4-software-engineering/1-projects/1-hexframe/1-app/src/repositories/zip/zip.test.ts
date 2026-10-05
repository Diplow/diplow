import { describe, expect, it } from 'vitest'

import { unzipped } from './testing'
import { type Entry, zipped } from './zip'

/** Every byte a stream sends, and how many reads it took. */
async function drained(stream: ReadableStream<Uint8Array>) {
  const chunks: Array<Uint8Array> = []
  for await (const chunk of stream) chunks.push(chunk)
  const bytes = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0))
  let at = 0
  for (const chunk of chunks) {
    bytes.set(chunk, at)
    at += chunk.length
  }
  return { bytes, reads: chunks.length }
}

describe('a list of files, zipped', () => {
  it('reads back as the same files, in their order, paths and text in UTF-8', async () => {
    const entries: ReadonlyArray<Entry> = [
      { path: 'CLAUDE.md', content: '---\ntitle: Root\n---\n\nBody' },
      { path: '1-a/CLAUDE.md', content: 'À la carte, 日本語' },
      { path: '1-a/.hexframe/config.yaml', content: 'fileName: SKILL.md\n' },
      { path: 'Café.md', content: '' },
    ]
    const { bytes } = await drained(zipped(entries))
    expect(unzipped(bytes)).toEqual(entries)
  })

  it('is an empty archive for no file', async () => {
    const { bytes } = await drained(zipped([]))
    expect(unzipped(bytes)).toEqual([])
  })

  it('streams: the archive comes in several reads, a file at a time, never whole first', async () => {
    const entries = Array.from({ length: 20 }, (_, index) => ({
      path: `${String(index)}.md`,
      content: `${String(index)} `.repeat(10_000),
    }))
    const stream = zipped(entries)
    const reader = stream.getReader()
    const first = await reader.read()
    expect(first.done).toBe(false)
    reader.releaseLock()
    const { bytes, reads } = await drained(stream)
    expect(reads).toBeGreaterThan(entries.length)
    expect(unzipped(new Uint8Array([...(first.value ?? []), ...bytes]))).toEqual(entries)
  })
})
