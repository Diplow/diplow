import { execFile } from 'node:child_process'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { promisify } from 'node:util'

import { describe, expect, it } from '@effect/vitest'
import { Duration, Effect, Exit, Option } from 'effect'

import { makeLocal } from './local'
import { type Box, inside, outsideTheSystem, type Run, sandboxName, systemFolder } from './sandbox'

// The sandbox on this machine, the fake every test and `pnpm dev` run on, as Blaxel's is used: an
// Account's sandbox ensured, its System folder written whole and read-only, a file written beside it,
// processes started, followed and stopped by name. Real processes and real time, so `it.live`.

/** Removes a folder a test made, its read-only folders made writable first. */
const removed = (folder: string) =>
  Effect.promise(async () => {
    await promisify(execFile)('chmod', ['-R', 'u+w', folder])
    await rm(folder, { recursive: true, force: true })
  })

/**
 * Every Account's sandbox in a fresh temporary folder, removed once the test ends, a stop's grace
 * short enough for a test.
 */
const sandboxes = () =>
  Effect.gen(function* () {
    const root = yield* Effect.promise(() => mkdtemp(join(tmpdir(), 'hexframe-sandbox-test-')))
    yield* Effect.addFinalizer(() => removed(root))
    return makeLocal({ root, grace: Duration.millis(300) })
  })

/** An Account no other test uses, and its sandbox. */
const boxOfSomeone = Effect.flatMap(sandboxes(), (sandbox) => sandbox.ensure(crypto.randomUUID()))

/** Every file under a folder, by its path from that folder, sorted. */
async function filesUnder(folder: string, from = folder): Promise<ReadonlyArray<string>> {
  const entries = await readdir(folder, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? filesUnder(join(folder, entry.name), from)
        : Promise.resolve([relative(from, join(folder, entry.name))]),
    ),
  )
  return nested.flat().sort()
}

/** A process of a few seconds at most, in the home, with no environment. */
const run = (name: string, command: string, more: Partial<Run> = {}): Run => ({
  name,
  command,
  workingDir: '.',
  env: {},
  timeoutSeconds: 5,
  ...more,
})

/** Waits until the process of this name no longer runs, and answers where it stands. */
const settled = (box: Box, name: string) =>
  Effect.gen(function* () {
    for (let tries = 0; tries < 100; tries++) {
      const status = yield* box.status(name)
      if (Option.isSome(status) && status.value.state !== 'running') return status.value
      yield* Effect.sleep(Duration.millis(50))
    }
    throw new Error(`${name} still runs`)
  })

/** Reads a file of the box, by its path from the home. */
const read = (box: Box, path: string) =>
  Effect.promise(() => readFile(join(box.home, path), 'utf8'))

describe('an Account’s sandbox', () => {
  it.live(
    'is the same for the same Account, another for another, named without the Account’s id',
    () =>
      Effect.gen(function* () {
        const sandbox = yield* sandboxes()
        const first = yield* sandbox.ensure('account-1')
        expect((yield* sandbox.ensure('account-1')).home).toBe(first.home)
        expect((yield* sandbox.ensure('account-2')).home).not.toBe(first.home)
        expect(first.name).toBe(sandboxName('local', 'account-1'))
        expect(first.name).not.toContain('account-1')
        expect(sandboxName('preview.example', 'account-1')).not.toBe(first.name)
        expect(first.name).toMatch(/^hexframe-[0-9a-f]{32}$/)
      }),
  )
})

describe('its System folder', () => {
  it.live('holds the files written, by their paths, folders made as needed', () =>
    Effect.gen(function* () {
      const box = yield* boxOfSomeone
      yield* box.replaceSystem([
        { path: 'CLAUDE.md', content: '# Root' },
        { path: '1-leadership/CLAUDE.md', content: '# Leadership' },
        { path: '1-leadership/.1-rules/SKILL.md', content: 'Rules' },
      ])
      expect(yield* Effect.promise(() => filesUnder(join(box.home, systemFolder)))).toEqual([
        '1-leadership/.1-rules/SKILL.md',
        '1-leadership/CLAUDE.md',
        'CLAUDE.md',
      ])
      expect(yield* read(box, 'system/1-leadership/.1-rules/SKILL.md')).toBe('Rules')
    }),
  )

  it.live('is rewritten whole: no file of the System before is left, nested ones included', () =>
    Effect.gen(function* () {
      const box = yield* boxOfSomeone
      yield* box.replaceSystem([
        { path: 'CLAUDE.md', content: 'before' },
        { path: '3-games/CLAUDE.md', content: 'moved away' },
        { path: '3-games/1-chess/1-openings.md', content: 'deep' },
      ])
      yield* box.replaceSystem([
        { path: 'CLAUDE.md', content: 'after' },
        { path: '5-games/CLAUDE.md', content: 'moved here' },
      ])
      expect(yield* Effect.promise(() => filesUnder(join(box.home, systemFolder)))).toEqual([
        '5-games/CLAUDE.md',
        'CLAUDE.md',
      ])
      expect(yield* read(box, 'system/CLAUDE.md')).toBe('after')
      yield* box.replaceSystem([])
      expect(yield* Effect.promise(() => filesUnder(join(box.home, systemFolder)))).toEqual([])
    }),
  )

  it.live('refuses a write, from this process or from one the sandbox runs', () =>
    Effect.gen(function* () {
      const box = yield* boxOfSomeone
      yield* box.replaceSystem([{ path: '1-a/CLAUDE.md', content: 'kept' }])
      const system = join(box.home, systemFolder)
      for (const path of ['CLAUDE.md', '1-a/CLAUDE.md', '1-a/new.md']) {
        const write = yield* Effect.promise(() =>
          writeFile(join(system, path), 'changed').then(
            () => 'written',
            (error: unknown) => (error as NodeJS.ErrnoException).code,
          ),
        )
        expect(write, path).toBe('EACCES')
      }
      yield* box.start(run('agent', 'echo changed > 1-a/CLAUDE.md', { workingDir: 'system' }))
      expect((yield* settled(box, 'agent')).state).toBe('failed')
      expect(yield* read(box, 'system/1-a/CLAUDE.md')).toBe('kept')
    }),
  )

  it.live('takes no path leaving it', () =>
    Effect.gen(function* () {
      const box = yield* boxOfSomeone
      const exit = yield* Effect.exit(box.replaceSystem([{ path: '../escaped.md', content: 'x' }]))
      expect(Exit.hasDies(exit)).toBe(true)
    }),
  )
})

describe('a file beside the System', () => {
  it.live('is written at its path from the home, its folders made', () =>
    Effect.gen(function* () {
      const box = yield* boxOfSomeone
      yield* box.write({ path: 'turn/prompt.md', content: 'Today' })
      expect(yield* read(box, 'turn/prompt.md')).toBe('Today')
    }),
  )

  it.live('is never written into the System folder nor out of the home: a defect', () =>
    Effect.gen(function* () {
      const box = yield* boxOfSomeone
      for (const path of ['system/CLAUDE.md', 'system', './system/x', '../out.md', '/etc/x', '']) {
        const exit = yield* Effect.exit(box.write({ path, content: 'x' }))
        expect(Exit.hasDies(exit), path).toBe(true)
      }
    }),
  )
})

describe('a process', () => {
  it.live('runs in its folder with its environment, and ends completed or failed by its code', () =>
    Effect.gen(function* () {
      const box = yield* boxOfSomeone
      yield* box.replaceSystem([{ path: '1-a/CLAUDE.md', content: '' }])
      yield* box.start(
        run('greet', 'printf "%s %s" "$(pwd)" "$GREETING" > "$HOME/out.txt"', {
          workingDir: 'system/1-a',
          env: { GREETING: 'hello' },
        }),
      )
      expect(yield* settled(box, 'greet')).toEqual({ state: 'completed', exitCode: 0 })
      const [cwd, greeting] = (yield* read(box, 'out.txt')).split(' ')
      expect(cwd).toMatch(/\/system\/1-a$/)
      expect(greeting).toBe('hello')
      yield* box.start(run('fail', 'exit 3'))
      expect(yield* settled(box, 'fail')).toEqual({ state: 'failed', exitCode: 3 })
    }),
  )

  it.live('is running until it ends, and none is known by a name never started', () =>
    Effect.gen(function* () {
      const box = yield* boxOfSomeone
      yield* box.start(run('long', 'sleep 2'))
      expect(yield* box.status('long')).toEqual(Option.some({ state: 'running' }))
      expect(yield* box.status('never')).toEqual(Option.none())
      const twice = yield* Effect.exit(box.start(run('long', 'sleep 2')))
      expect(Exit.hasDies(twice)).toBe(true)
      yield* box.stop('long')
    }),
  )

  it.live('stops on SIGINT when it listens, so an agent ends its turn cleanly', () =>
    Effect.gen(function* () {
      const box = yield* boxOfSomeone
      yield* box.start(
        run('agent', 'trap "echo interrupted > \\"$HOME/how.txt\\"; exit 130" INT; sleep 5 & wait'),
      )
      yield* Effect.sleep(Duration.millis(100))
      yield* box.stop('agent')
      expect(yield* settled(box, 'agent')).toEqual({ state: 'stopped' })
      expect((yield* read(box, 'how.txt')).trim()).toBe('interrupted')
    }),
  )

  it.live('is killed when it ignores the interrupt past its grace, or runs past its time', () =>
    Effect.gen(function* () {
      const box = yield* boxOfSomeone
      yield* box.start(run('deaf', 'trap "" INT; sleep 5 & wait'))
      yield* Effect.sleep(Duration.millis(100))
      yield* box.stop('deaf')
      expect(yield* settled(box, 'deaf')).toEqual({ state: 'killed' })
      yield* box.start(run('slow', 'sleep 5', { timeoutSeconds: 0.2 }))
      expect(yield* settled(box, 'slow')).toEqual({ state: 'killed' })
      yield* box.stop('slow')
      expect(yield* box.status('slow')).toEqual(Option.some({ state: 'killed' }))
    }),
  )
})

describe('a path of the sandbox', () => {
  it('is normalized, and refused when it leaves its folder or is absolute', () => {
    expect(inside('a/./b/../c.md')).toBe('a/c.md')
    for (const path of ['', '..', '../a', 'a/../../b', '/a']) {
      expect(() => inside(path), path).toThrow()
    }
  })

  it('beside the System is anywhere in the home but the System folder', () => {
    expect(outsideTheSystem('turn/prompt.md')).toBe('turn/prompt.md')
    expect(outsideTheSystem('systems/x')).toBe('systems/x')
    for (const path of ['system', 'system/x', 'a/../system/x']) {
      expect(() => outsideTheSystem(path), path).toThrow()
    }
  })
})
