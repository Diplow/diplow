import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { devPluginDir } from './plugin-dir.ts'

const repoRoot = '/work/diplow'

describe('devPluginDir', () => {
  it("writes into the repo's own vault by default", () => {
    expect(devPluginDir({}, repoRoot)).toBe('/work/diplow/.obsidian/plugins/hexframe')
  })

  it('ignores an empty HEXFRAME_VAULT', () => {
    expect(devPluginDir({ HEXFRAME_VAULT: '' }, repoRoot)).toBe(
      '/work/diplow/.obsidian/plugins/hexframe',
    )
  })

  it('writes into the vault HEXFRAME_VAULT names', () => {
    expect(devPluginDir({ HEXFRAME_VAULT: '/notes/perso' }, repoRoot)).toBe(
      '/notes/perso/.obsidian/plugins/hexframe',
    )
  })

  it('resolves a relative HEXFRAME_VAULT from the current folder', () => {
    expect(devPluginDir({ HEXFRAME_VAULT: 'perso' }, repoRoot)).toBe(
      join(resolve('perso'), '.obsidian/plugins/hexframe'),
    )
  })
})
