// The esbuild bundle of the plugin: src/main.ts into main.js, with manifest.json and styles.css copied beside it.
import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises'
import { builtinModules } from 'node:module'
import { join } from 'node:path'

import esbuild from 'esbuild'

const packageDir = join(import.meta.dirname, '..')

// The files a build copies beside main.js as they are.
const copied = ['manifest.json', 'styles.css']

// A dev bundle carries an inline source map and a `.hotreload` file, which the hot-reload plugin
// watches for. A production one is minified, and removes a `.hotreload` a dev build left, so the
// folder holds the committed build and nothing else.
export async function bundle({ outDir, dev }: { outDir: string; dev: boolean }) {
  await mkdir(outDir, { recursive: true })
  await Promise.all(copied.map((name) => copyFile(join(packageDir, name), join(outDir, name))))
  const hotReload = join(outDir, '.hotreload')
  await (dev ? writeFile(hotReload, '') : rm(hotReload, { force: true }))

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
    // Minifying turns a `\n` inside a template literal into a raw line break. Lowered to string
    // concatenation it stays an escape, so a production build stays on one line, the mark of a
    // minified build that bundle.test.ts checks.
    supported: { 'template-literal': false },
    logLevel: 'info',
    sourcemap: dev ? 'inline' : false,
    minify: !dev,
    treeShaking: true,
  })
}
