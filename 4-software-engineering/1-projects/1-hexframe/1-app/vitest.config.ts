import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  // Tests run as `pnpm dev` does: the /dev pages and their server functions are on (vite.config.ts).
  define: { __DEV_PAGES__: 'true' },
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
})
