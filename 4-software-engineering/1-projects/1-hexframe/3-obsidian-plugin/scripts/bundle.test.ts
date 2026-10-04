import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { bundle } from './bundle.ts'

let outDir: string

beforeEach(async () => {
  outDir = await mkdtemp(join(tmpdir(), 'hexframe-plugin-'))
})

afterEach(async () => {
  await rm(outDir, { recursive: true, force: true })
})

async function build(dev: boolean) {
  const context = await bundle({ outDir, dev })
  try {
    await context.rebuild()
  } finally {
    await context.dispose()
  }
  return readFile(join(outDir, 'main.js'), 'utf8')
}

describe('bundle', () => {
  it.each(['manifest.json', 'styles.css'])('writes main.js beside a copy of %s', async (name) => {
    await build(false)
    const source = await readFile(join(import.meta.dirname, '..', name), 'utf8')
    expect(await readFile(join(outDir, name), 'utf8')).toBe(source)
  })

  it('copies them again on every rebuild, as a dev build does when one changes', async () => {
    const context = await bundle({ outDir, dev: true })
    try {
      await context.rebuild()
      await writeFile(join(outDir, 'styles.css'), 'stale')
      await context.rebuild()
    } finally {
      await context.dispose()
    }
    const source = await readFile(join(import.meta.dirname, '..', 'styles.css'), 'utf8')
    expect(await readFile(join(outDir, 'styles.css'), 'utf8')).toBe(source)
  })

  it('builds production deterministically: the same sources give the same bytes in any folder', async () => {
    const first = await build(false)
    const otherDir = outDir
    outDir = await mkdtemp(join(tmpdir(), 'hexframe-plugin-other-'))
    try {
      expect(await build(false)).toBe(first)
    } finally {
      await rm(otherDir, { recursive: true, force: true })
    }
  })

  it('leaves the obsidian API to Obsidian, as a CommonJS module', async () => {
    const main = await build(false)
    expect(main).toContain('require("obsidian")')
    expect(main).toContain('module.exports')
  })

  it('builds production minified, with no source map and no .hotreload', async () => {
    const main = await build(false)
    expect(main).not.toContain('sourceMappingURL')
    expect(main.split('\n').length).toBeLessThanOrEqual(2)
    expect(existsSync(join(outDir, '.hotreload'))).toBe(false)
  })

  it('removes the .hotreload a dev build left', async () => {
    await writeFile(join(outDir, '.hotreload'), '')
    await build(false)
    expect(existsSync(join(outDir, '.hotreload'))).toBe(false)
  })

  it('builds dev with an inline source map and a .hotreload file', async () => {
    const main = await build(true)
    expect(main).toContain('sourceMappingURL=data:application/json')
    expect(existsSync(join(outDir, '.hotreload'))).toBe(true)
  })
})
