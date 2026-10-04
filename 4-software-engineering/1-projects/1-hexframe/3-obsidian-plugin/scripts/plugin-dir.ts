// Where the builds write the plugin: into a vault's `.obsidian/plugins/<id>/`, the folder Obsidian loads it from.
import { join, resolve } from 'node:path'

import manifest from '../manifest.json' with { type: 'json' }

// The plugin folder in the vault whose root is `vaultRoot`.
function pluginDirIn(vaultRoot: string) {
  return join(vaultRoot, '.obsidian', 'plugins', manifest.id)
}

// Where `pnpm build` writes: the repo's own vault, its root being `repoRoot`, where the build is committed.
export function buildPluginDir(repoRoot: string) {
  return pluginDirIn(repoRoot)
}

// Where `pnpm dev` writes: the vault HEXFRAME_VAULT names, or else the repo's own.
export function devPluginDir(env: Readonly<Record<string, string | undefined>>, repoRoot: string) {
  const vault = env['HEXFRAME_VAULT']
  return pluginDirIn(vault === undefined || vault === '' ? repoRoot : resolve(vault))
}
