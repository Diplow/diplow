import { paraglideVitePlugin } from '@inlang/paraglide-js'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: { tsconfigPaths: true },
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
})
