// Where `pnpm dev` writes the plugin: into a vault's `.obsidian/plugins/<id>/`, the folder Obsidian loads it from.
import { join, resolve } from 'node:path'

import manifest from '../manifest.json' with { type: 'json' }

// The plugin folder in the vault HEXFRAME_VAULT names, or else in the repo's own vault, its root being `repoRoot`.
export function devPluginDir(env: Readonly<Record<string, string | undefined>>, repoRoot: string) {
  const vault = env['HEXFRAME_VAULT']
  const root = vault === undefined || vault === '' ? repoRoot : resolve(vault)
  return join(root, '.obsidian', 'plugins', manifest.id)
}
