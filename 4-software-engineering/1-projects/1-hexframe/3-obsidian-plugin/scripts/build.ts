// Bundles src/main.ts into the plugin's main.js with esbuild.
//   node scripts/build.ts            production build into dist/, minified
//   node scripts/build.ts --watch    dev build into a vault's plugin folder (see plugin-dir.ts), rebuilt on change
import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import { builtinModules } from 'node:module'
import { join } from 'node:path'

import esbuild from 'esbuild'

import { devPluginDir } from './plugin-dir.ts'

const packageDir = join(import.meta.dirname, '..')
const repoRoot = join(packageDir, '../../../..')
const watch = process.argv.includes('--watch')
const outDir = watch ? devPluginDir(process.env, repoRoot) : join(packageDir, 'dist')

await mkdir(outDir, { recursive: true })
await copyFile(join(packageDir, 'manifest.json'), join(outDir, 'manifest.json'))
// The hot-reload plugin reloads a plugin whose folder holds this file, each time its main.js changes.
if (watch) await writeFile(join(outDir, '.hotreload'), '')

const context = await esbuild.context({
  entryPoints: [join(packageDir, 'src/main.ts')],
  outfile: join(outDir, 'main.js'),
  bundle: true,
  // Obsidian provides these at runtime: its API, Electron, CodeMirror and Node's own modules.
  external: [
    'obsidian',
    'electron',
    '@codemirror/*',
    '@lezer/*',
    ...builtinModules,
    ...builtinModules.map((name) => `node:${name}`),
  ],
  format: 'cjs',
  target: 'es2022',
  logLevel: 'info',
  sourcemap: watch ? 'inline' : false,
  minify: !watch,
  treeShaking: true,
})

if (watch) {
  await context.watch()
} else {
  await context.rebuild()
  await context.dispose()
}
