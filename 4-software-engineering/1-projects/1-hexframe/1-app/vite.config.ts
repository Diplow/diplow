import { paraglideVitePlugin } from '@inlang/paraglide-js'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'

import { shippedChecked } from './scripts/check-shipped'
import { environmentOf, type Environment } from './src/api/report/observability/levels'

/** The globals src/vite-env.d.ts declares, for where the app runs; vitest.config.ts sets them too. */
export function definesFor(environment: Environment) {
  return {
    // Where the app runs, for the verbosity it logs at (src/api/report/observability/levels.ts).
    __ENVIRONMENT__: JSON.stringify(environment),
  }
}

export default defineConfig(({ command }) => ({
  resolve: { tsconfigPaths: true },
  define: definesFor(environmentOf(command, process.env.VERCEL_ENV)),
  plugins: [
    // The Systems hexframe ships, Help and the tutorial, are bundled into the server
    // (src/domains/mapping/shipped/): a folder of one that reads as no Tile fails the build.
    shippedChecked(),
    paraglideVitePlugin({
      project: './project.inlang',
      // Generated, so outside src/ and the rule of 6; `#/paraglide/*` reaches it (tsconfig.json).
      outdir: './paraglide',
      // The locale lives in the URL (`/` English, `/fr/…` French), so a link shows what its sender saw.
      strategy: ['url', 'baseLocale'],
    }),
    // Nitro builds the server for Vercel's Node runtime. It is a beta, and this is its seam: the one line to swap.
    nitro(),
    tailwindcss(),
    // The routes sit in the front layer (src/front/), beside the features and the design system.
    tanstackStart({ router: { routesDirectory: 'front/routes' } }),
    viteReact(),
  ],
}))
