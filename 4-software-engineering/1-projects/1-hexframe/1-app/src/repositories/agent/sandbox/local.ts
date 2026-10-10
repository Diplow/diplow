// The sandbox on this machine, a fake of Blaxel's: each Account's sandbox a folder under a root, its
// System folder made read-only by its modes, its processes children of this one, each in a process
// group of its own so a kill reaches what it started. In Claude Code's place it runs a fake agent
// (./fake-agent.ts), unless the environment asks for Claude Code. Every test runs on it, and `pnpm dev`
// without `BL_API_KEY` (src/api/server/run.ts). No isolation: it is for the app's own commands, never
// a user's.
import { type ChildProcess, spawn } from 'node:child_process'
import { chmod, lstat, mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { Duration, Effect, Layer, Option } from 'effect'

import { fakeAgent } from './fake-agent'
import {
  type Box,
  ended,
  inside,
  outsideTheSystem,
  type Run,
  type RunStatus,
  Sandbox,
  type SandboxFile,
  sandboxName,
  systemFolder,
  workFolder,
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

/**
 * Sends a signal to a child: a SIGINT to its own process, as Blaxel's layer sends it, so a command
 * line that does not end in `exec` is caught here as there; a kill to its whole group, so nothing
 * its shell started outlives it.
 */
function signal(child: Child, name: 'SIGINT' | 'SIGKILL'): void {
  const { pid } = child.process
  if (pid === undefined) return
  try {
    process.kill(name === 'SIGKILL' ? -pid : pid, name)
  } catch {
    // It is gone already: it ended on its own meanwhile.
  }
}

/** A child's state once it exited, by the signal that ended it or by its exit code. */
const endedAs = (code: number | null, by: NodeJS.Signals | null): RunStatus =>
  by === 'SIGINT' || by === 'SIGKILL' ? ended({ signal: by }) : ended({ code: code ?? -1 })

/**
 * A process started detached in its own group, in `cwd`, with its environment, its HOME the work
 * folder and the PATH to find its commands, killed once its time is up.
 */
function spawned(run: Run, { cwd, home }: { cwd: string; home: string }): Child {
  const started = spawn('sh', ['-c', run.command], {
    cwd,
    env: { PATH: process.env.PATH ?? '', HOME: join(home, workFolder), ...run.env },
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

/** Which agent the sandbox on this machine runs: the fake one, at its pace, or Claude Code itself. */
type Agent = { readonly fake: { readonly pace: number } } | 'claude'

/**
 * Every Account's sandbox as a folder under `root`, named as Blaxel's would be, in the namespace
 * `local`, reaching the app where the request reached it. A stop waits `grace` for a process it
 * interrupted before killing it. Its agent is the fake one, written under `root` beside the boxes,
 * waiting `pace` milliseconds before each tool, unless `agent` asks for Claude Code.
 */
export function makeLocal({
  root,
  grace = Duration.seconds(5),
  agent = { fake: { pace: 2_000 } },
}: {
  readonly root: string
  readonly grace?: Duration.Duration
  readonly agent?: Agent
}): Sandbox['Service'] {
  // A box per name, kept as it is being made, so two ensures at once share one, and its processes.
  const boxes = new Map<string, Promise<Box>>()
  const script = join(root, 'fake-agent.mjs')
  return {
    agent: agent === 'claude' ? ['claude'] : ['node', script, '--pace', String(agent.fake.pace)],
    origin: (requested) => requested,
    ensure: (accountId: string) =>
      Effect.promise(() => {
        const name = sandboxName('local', accountId)
        const found = boxes.get(name)
        if (found !== undefined) return found
        const home = join(root, name)
        const made = Promise.all([
          mkdir(join(home, workFolder), { recursive: true }),
          written(script, fakeAgent),
        ])
        const box = made.then(
          () => boxAt(name, home, grace),
          (error: unknown) => {
            // A box that could not be made is not kept: the next ensure tries again.
            boxes.delete(name)
            throw error
          },
        )
        boxes.set(name, box)
        return box
      }),
  }
}

/**
 * The agent `pnpm dev` and the tests run: Claude Code when `HEXFRAME_AGENT` is `claude`, else the fake
 * one, at the pace `HEXFRAME_FAKE_AGENT_PACE` sets in milliseconds, 2 s by default.
 */
export const agentOf = (env: Readonly<Record<string, string | undefined>>): Agent => {
  if (env.HEXFRAME_AGENT === 'claude') return 'claude'
  const given = (env.HEXFRAME_FAKE_AGENT_PACE ?? '').trim()
  const pace = given === '' ? Number.NaN : Number(given)
  return { fake: { pace: Number.isFinite(pace) && pace >= 0 ? pace : 2_000 } }
}

/** The sandbox on this machine, every Account's a folder of the system's temporary one. */
export const layer = Layer.sync(Sandbox, () =>
  makeLocal({ root: join(tmpdir(), 'hexframe-sandboxes'), agent: agentOf(process.env) }),
)
