// The esbuild bundle of the plugin: src/main.ts into main.js, with manifest.json copied beside it.
import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import { builtinModules } from 'node:module'
import { join } from 'node:path'

import esbuild from 'esbuild'

const packageDir = join(import.meta.dirname, '..')

// A dev bundle carries an inline source map and a `.hotreload` file, which the hot-reload plugin
// watches for; a production one is minified.
export async function bundle({ outDir, dev }: { outDir: string; dev: boolean }) {
  await mkdir(outDir, { recursive: true })
  await copyFile(join(packageDir, 'manifest.json'), join(outDir, 'manifest.json'))
  if (dev) await writeFile(join(outDir, '.hotreload'), '')

  return esbuild.context({
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
    sourcemap: dev ? 'inline' : false,
    minify: !dev,
    treeShaking: true,
  })
}
