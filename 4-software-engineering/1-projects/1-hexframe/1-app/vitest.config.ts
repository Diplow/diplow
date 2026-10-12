import { defineConfig } from 'vitest/config'

import { environmentOf } from './src/api/report/observability/levels'
import { definesFor } from './vite.config'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  // Tests run where `pnpm dev` does.
  define: definesFor(environmentOf('serve', undefined)),
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    // The server function runtime runs on an in-memory PGlite when DATABASE_URL is empty, on the
    // sandbox of this machine when BL_API_KEY is, and on a fake Anthropic when ANTHROPIC_API_KEY is
    // (src/api/server/run.ts): a test never reaches a real database, Blaxel nor Anthropic, whatever
    // the shell exports. One Account is entitled to the Assistant, by
    // its email, whatever the shell lists (src/repositories/auth/allowlist.ts).
    env: {
      DATABASE_URL: '',
      BL_API_KEY: '',
      BL_WORKSPACE: '',
      ANTHROPIC_API_KEY: '',
      ASSISTANT_ACCOUNTS: 'entitled@example.com',
      // The sandbox on this machine runs the fake agent, at no pace, never Claude Code itself
      // (src/repositories/agent/sandbox/local.ts).
      HEXFRAME_AGENT: '',
      HEXFRAME_FAKE_AGENT_PACE: '0',
    },
  },
})
