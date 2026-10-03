// drizzle-kit's settings. `pnpm db:generate` writes the next migration from the schema; migrations are
// committed and applied by `pnpm db:migrate`, the same ones the PGlite tests run.
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/repositories/database/schema.ts',
  out: './migrations',
})
