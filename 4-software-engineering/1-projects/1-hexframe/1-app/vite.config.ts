import { paraglideVitePlugin } from '@inlang/paraglide-js'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'

export default defineConfig(({ command }) => ({
  resolve: { tsconfigPaths: true },
  define: {
    // The /dev pages: served by `pnpm dev` and on Vercel previews, a 404 in production and in a local build.
    __DEV_PAGES__: JSON.stringify(command === 'serve' || process.env.VERCEL_ENV === 'preview'),
    // Where the app runs, for the verbosity it logs at (src/api/observability/): a local build counts as production.
    __ENVIRONMENT__: JSON.stringify(
      command === 'serve'
        ? 'development'
        : process.env.VERCEL_ENV === 'preview'
          ? 'preview'
          : 'production',
    ),
  },
  plugins: [
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/paraglide',
      // The locale lives in the URL (`/` English, `/fr/…` French), so a link shows what its sender saw.
      strategy: ['url', 'baseLocale'],
    }),
    // Nitro builds the server for Vercel's Node runtime. It is a beta, and this is its seam: the one line to swap.
    nitro(),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
}))
