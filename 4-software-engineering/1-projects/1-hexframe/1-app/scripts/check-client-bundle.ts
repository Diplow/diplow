// What `build` checks once Vite and Nitro are done: the client bundle holds nothing of the server.
// Start strips what a server function's handler alone uses, not what a module exports, so a module a
// page imports can drag the server function runtime, Better Auth or Drizzle into the browser's code
// (src/api/CLAUDE.md). No lint sees what the compiler strips; the bundle itself does.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// Nitro writes the client to .vercel/output/static when it builds for Vercel (VERCEL_ENV set), to
// .output/public otherwise. Only this build's output is checked: the other may be a stale one.
const folder =
  process.env.VERCEL_ENV === undefined ? '.output/public/assets' : '.vercel/output/static/assets'
// Markers of server code: the runtime's services, the SDKs behind the repositories, their secret.
const markers = [
  'ManagedRuntime',
  'hexframe/RequestContext',
  'hexframe/Auth',
  'better-auth',
  'drizzle',
  'BETTER_AUTH_SECRET',
]

if (!existsSync(folder)) {
  console.error(`No client bundle to check: ${folder} does not exist.`)
  process.exit(1)
}

const leaks = readdirSync(folder)
  .filter((file) => file.endsWith('.js'))
  .flatMap((file) => {
    const code = readFileSync(join(folder, file), 'utf8')
    return markers
      .filter((marker) => code.includes(marker))
      .map((marker) => `${join(folder, file)}: ${marker}`)
  })

if (leaks.length > 0) {
  console.error(
    'Server code reached the client bundle. Keep run.ts inside the handlers of what a page imports:',
  )
  for (const leak of leaks) console.error(`  ${leak}`)
  process.exit(1)
}
