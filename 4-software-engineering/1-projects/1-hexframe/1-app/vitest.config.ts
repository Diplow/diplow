import { defineConfig } from 'vitest/config'

import { environmentOf } from './src/api/report/observability/levels'
import { definesFor } from './vite.config'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  // Tests run as `pnpm dev` does: the /dev pages and their server functions are on.
  define: definesFor(environmentOf('serve', undefined)),
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    // The server function runtime runs on an in-memory PGlite when DATABASE_URL is empty, and on the
    // sandbox of this machine when BL_API_KEY is (src/api/server/run.ts): a test never reaches a real
    // database nor Blaxel, whatever the shell exports.
    env: { DATABASE_URL: '', BL_API_KEY: '', BL_WORKSPACE: '' },
  },
})
