// Builds the plugin.
//   node scripts/build.ts            production build into the repo's .obsidian/plugins/hexframe/, which is committed
//   node scripts/build.ts --watch    dev build into a vault's plugin folder (see plugin-dir.ts), rebuilt on change
import { join } from 'node:path'

import { bundle } from './bundle.ts'
import { buildPluginDir, devPluginDir } from './plugin-dir.ts'

const packageDir = join(import.meta.dirname, '..')
const repoRoot = join(packageDir, '../../../..')
const dev = process.argv.includes('--watch')

const context = await bundle({
  outDir: dev ? devPluginDir(process.env, repoRoot) : buildPluginDir(repoRoot),
  dev,
})

if (dev) {
  await context.watch()
} else {
  await context.rebuild()
  await context.dispose()
}
