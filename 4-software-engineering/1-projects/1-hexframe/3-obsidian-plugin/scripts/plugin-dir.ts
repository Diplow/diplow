// Where `pnpm dev` writes the plugin: into a vault's `.obsidian/plugins/<id>/`, the folder Obsidian loads it from.
import { join, resolve } from 'node:path'

import manifest from '../manifest.json' with { type: 'json' }

// The variable that points `pnpm dev` at another vault than the worktree it runs in.
export const vaultVariable = 'HEXFRAME_VAULT'

// The plugin folder in the vault `env` names, or else in the repo's own vault, its root being `repoRoot`.
export function devPluginDir(env: Readonly<Record<string, string | undefined>>, repoRoot: string) {
  const vault = env[vaultVariable]
  const root = vault === undefined || vault === '' ? repoRoot : resolve(vault)
  return join(root, '.obsidian', 'plugins', manifest.id)
}
