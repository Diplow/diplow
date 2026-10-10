// The sandbox on this machine, a fake of Blaxel's: each Account's sandbox a folder under a root, its
// System folder made read-only by its modes, its processes children of this one, each in a process
// group of its own so a stop reaches what it started. Every test runs on it, and `pnpm dev` without
// `BL_API_KEY` (src/api/server/run.ts). No isolation: it is for the app's own commands, never a user's.
import { type ChildProcess, spawn } from 'node:child_process'
import { chmod, lstat, mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { Duration, Effect, Layer, Option } from 'effect'

import {
  type Box,
  inside,
  interrupted,
  outsideTheSystem,
  type Run,
  type RunStatus,
  Sandbox,
  type SandboxFile,
  sandboxName,
  systemFolder,
} from './sandbox'

/** A process this machine started, as it stands. */
interface Child {
  readonly process: ChildProcess
  readonly ended: Promise<void>
  status: RunStatus
}

/** Modes that make a tree read-only, or writable again by its owner. */
const readOnly = { file: 0o444, folder: 0o555 }
const writable = { file: 0o644, folder: 0o755 }

/** Sets the modes of every file and folder of a tree, its root included; nothing for a missing one. */
async function modesOf(path: string, modes: typeof readOnly): Promise<void> {
  const stat = await lstat(path).catch(() => undefined)
  if (stat === undefined || stat.isSymbolicLink()) return
  if (!stat.isDirectory()) {
    await chmod(path, modes.file)
    return
  }
  await chmod(path, modes.folder)
  for (const entry of await readdir(path)) await modesOf(join(path, entry), modes)
}

/** Writes a file, its folders first. */
async function written(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content)
}

/** Sends a signal to a child's process group, which holds what its shell started. */
function signal(child: Child, name: NodeJS.Signals): void {
  const { pid } = child.process
  if (pid === undefined) return
  try {
    process.kill(-pid, name)
  } catch {
    // The group is gone already: it ended on its own meanwhile.
  }
}

/**
 * A child's state once it exited, by how it ended, as Blaxel reports it: a SIGINT, or the exit code a
 * shell reports one by, `stopped`; a kill `killed`; otherwise its code.
 */
function endedAs(code: number | null, by: NodeJS.Signals | null): RunStatus {
  if (by === 'SIGINT' || code === interrupted) return { state: 'stopped' }
  if (by === 'SIGKILL') return { state: 'killed' }
  return code === 0
    ? { state: 'completed', exitCode: 0 }
    : { state: 'failed', exitCode: code ?? -1 }
}

/**
 * A process started detached in its own group, in `cwd`, with its environment and the bare minimum
 * to find its commands, killed once its time is up.
 */
function spawned(run: Run, { cwd, home }: { cwd: string; home: string }): Child {
  const started = spawn('sh', ['-c', run.command], {
    cwd,
    env: { PATH: process.env.PATH ?? '', HOME: home, ...run.env },
    detached: true,
    stdio: 'ignore',
  })
  started.unref()
  const child: Child = {
    process: started,
    status: { state: 'running' },
    ended: new Promise((resolve) => {
      const timer = setTimeout(() => {
        signal(child, 'SIGKILL')
      }, run.timeoutSeconds * 1000)
      timer.unref()
      const end = (status: RunStatus) => {
        child.status = status
        clearTimeout(timer)
        resolve()
      }
      started.once('exit', (code, by) => {
        end(endedAs(code, by))
      })
      started.once('error', () => {
        end({ state: 'failed', exitCode: -1 })
      })
    }),
  }
  return child
}

/** One Account's sandbox, a folder of this machine, its processes followed in `children`. */
function boxAt(name: string, home: string, grace: Duration.Duration): Box {
  const children = new Map<string, Child>()
  const system = join(home, systemFolder)

  const start = (run: Run) =>
    Effect.gen(function* () {
      if (children.get(run.name)?.status.state === 'running') {
        return yield* Effect.die(new Error(`A process named ${run.name} is running already`))
      }
      const cwd = join(home, inside(run.workingDir))
      yield* Effect.promise(() => mkdir(cwd, { recursive: true }))
      yield* Effect.sync(() => children.set(run.name, spawned(run, { cwd, home })))
    })

  const stop = (processName: string) =>
    Effect.promise(async () => {
      const child = children.get(processName)
      if (child === undefined || child.status.state !== 'running') return
      signal(child, 'SIGINT')
      const graced = new Promise<'grace'>((resolve) => {
        setTimeout(() => {
          resolve('grace')
        }, Duration.toMillis(grace)).unref()
      })
      if ((await Promise.race([child.ended, graced])) === 'grace') {
        signal(child, 'SIGKILL')
        await child.ended
      }
    })

  return {
    name,
    home,
    replaceSystem: (files: ReadonlyArray<SandboxFile>) =>
      Effect.promise(async () => {
        const paths = files.map(({ path, content }) => ({ path: inside(path), content }))
        await modesOf(system, writable)
        await rm(system, { recursive: true, force: true })
        await mkdir(system, { recursive: true })
        for (const { path, content } of paths) await written(join(system, path), content)
        await modesOf(system, readOnly)
      }),
    write: ({ path, content }: SandboxFile) =>
      Effect.flatMap(
        Effect.sync(() => outsideTheSystem(path)),
        (normalized) => Effect.promise(() => written(join(home, normalized), content)),
      ),
    start,
    stop,
    status: (processName: string) =>
      Effect.sync(() =>
        Option.map(Option.fromNullishOr(children.get(processName)), (child) => child.status),
      ),
  }
}

/**
 * Every Account's sandbox as a folder under `root`, named as Blaxel's would be, in the namespace
 * `local`. A stop waits `grace` for a process it interrupted before killing it.
 */
export function makeLocal({
  root,
  grace = Duration.seconds(5),
}: {
  readonly root: string
  readonly grace?: Duration.Duration
}): Sandbox['Service'] {
  // A box per name, kept as it is being made, so two ensures at once share one, and its processes.
  const boxes = new Map<string, Promise<Box>>()
  return {
    ensure: (accountId: string) =>
      Effect.promise(() => {
        const name = sandboxName('local', accountId)
        const found = boxes.get(name)
        if (found !== undefined) return found
        const home = join(root, name)
        const box = mkdir(home, { recursive: true }).then(() => boxAt(name, home, grace))
        boxes.set(name, box)
        return box
      }),
  }
}

/** The sandbox on this machine, every Account's a folder of the system's temporary one. */
export const layer = Layer.sync(Sandbox, () =>
  makeLocal({ root: join(tmpdir(), 'hexframe-sandboxes') }),
)
