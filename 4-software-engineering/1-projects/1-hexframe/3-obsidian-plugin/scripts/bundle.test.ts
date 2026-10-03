import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
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
  await context.rebuild()
  await context.dispose()
  return readFile(join(outDir, 'main.js'), 'utf8')
}

describe('bundle', () => {
  it('writes main.js beside a copy of the manifest', async () => {
    await build(false)
    const manifest = await readFile(join(import.meta.dirname, '../manifest.json'), 'utf8')
    expect(await readFile(join(outDir, 'manifest.json'), 'utf8')).toBe(manifest)
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

  it('builds dev with an inline source map and a .hotreload file', async () => {
    const main = await build(true)
    expect(main).toContain('sourceMappingURL=data:application/json')
    expect(existsSync(join(outDir, '.hotreload'))).toBe(true)
  })
})
