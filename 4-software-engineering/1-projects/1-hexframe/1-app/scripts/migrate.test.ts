// `pnpm db:migrate` runs under plain Node, with no bundler to resolve an import: this proves every
// module it reaches loads, and that it gets as far as reading DATABASE_URL, without touching a database.
import { execFile } from 'node:child_process'
import { join } from 'node:path'
import { promisify } from 'node:util'

import { describe, expect, it } from 'vitest'

const run = promisify(execFile)
const script = join(import.meta.dirname, 'migrate.ts')

describe('the migrate script', () => {
  it('loads under plain Node and stops on a missing DATABASE_URL', async () => {
    const env = { ...process.env }
    delete env.DATABASE_URL
    const failed = await run(process.execPath, [script], { env }).then(
      () => ({ stderr: '' }),
      (error: unknown) => error as { stderr: string },
    )
    expect(failed.stderr).toContain('ConfigError')
    expect(failed.stderr).not.toContain('ERR_MODULE_NOT_FOUND')
  }, 30_000)
})
