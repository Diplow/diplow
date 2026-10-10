// An Account's sandbox, where a Turn runs its agent: a machine of the Account's own, its System as
// files in one folder, read-only, rewritten whole before every Turn, and the agent's processes,
// started detached, followed and stopped by name. The service is what the layers share: Blaxel's
// (./blaxel.ts), the one module that imports `@blaxel/core`, and a fake on this machine (./local.ts),
// which every test and `pnpm dev` without `BL_API_KEY` run on. It speaks paths, text and commands;
// what a Turn writes and runs is Assistant's.
import { createHash } from 'node:crypto'
import { posix } from 'node:path'

import { Context, type Effect, type Option } from 'effect'

/** A file of the sandbox: its path, from the folder it is written in, and its text. */
export interface SandboxFile {
  readonly path: string
  readonly content: string
}

/** A process to start in the sandbox, detached, which survives the request that started it. */
export interface Run {
  /** What the process is known by, to follow and stop it; one per process of a sandbox. */
  readonly name: string
  /** A shell command line. The signal a stop sends reaches its own process: a script ends in `exec`. */
  readonly command: string
  /** The folder it runs in, from the sandbox's home: `system/1-leadership`, a Tile's folder. */
  readonly workingDir: string
  /** Its environment, the only place a secret given to the sandbox may go. */
  readonly env: Readonly<Record<string, string>>
  /** How long it may run before it is killed, keeping the sandbox awake meanwhile. */
  readonly timeoutSeconds: number
}

/** The exit code of a process a SIGINT ended, as a shell reports it: 128 and the signal's number. */
const interrupted = 130

/**
 * Where a process stands: running, or ended, by how it ended rather than by who ended it, so both
 * layers read it alike: well (`completed`), interrupted by a SIGINT (`stopped`), which a shell
 * reports as the exit code `interrupted`, killed (`killed`), past a stop's grace or its time, or
 * otherwise (`failed`); the two that ended by themselves with their exit code.
 */
export type RunStatus =
  | { readonly state: 'running' | 'stopped' | 'killed' }
  | { readonly state: 'completed' | 'failed'; readonly exitCode: number }

/** How a process ended, as a layer learns it: its exit code, or the signal that ended it. */
export type Ending = { readonly code: number } | { readonly signal: 'SIGINT' | 'SIGKILL' }

/** A process's state by how it ended: the one rule both layers read it by. */
export function ended(how: Ending): RunStatus {
  if ('signal' in how) return { state: how.signal === 'SIGINT' ? 'stopped' : 'killed' }
  if (how.code === interrupted) return { state: 'stopped' }
  return how.code === 0
    ? { state: 'completed', exitCode: 0 }
    : { state: 'failed', exitCode: how.code }
}

/** One Account's sandbox, ensured. */
export interface Box {
  /** The sandbox's name, derived from the Account, never its id. */
  readonly name: string
  /** The folder every path of the sandbox is from, absolute inside the sandbox. */
  readonly home: string
  /**
   * Writes these files, their paths from the System folder (`system/`), as the whole of it: whatever
   * it held before is gone. Then the folder is read-only, every file and folder in it.
   */
  readonly replaceSystem: (files: ReadonlyArray<SandboxFile>) => Effect.Effect<void>
  /** Writes one file, its path from the home, outside the System folder: a Turn's prompt, its script. */
  readonly write: (file: SandboxFile) => Effect.Effect<void>
  /**
   * Starts a process, detached, its HOME a folder of its own in the work folder, named by it
   * (`homeOf`), everything else the work folder held gone first, so no process leaves a setting or a
   * hook to the next; a name already running is a defect. On Blaxel it runs as a user of its own,
   * who may write the work folder and not the System folder.
   */
  readonly start: (run: Run) => Effect.Effect<void>
  /**
   * Stops a process: interrupts it (SIGINT), so an agent ends its turn cleanly, then kills it if it
   * still runs after a grace. A process that is not running is left as it is.
   */
  readonly stop: (name: string) => Effect.Effect<void>
  /** Where a process of this name stands; none when the sandbox knows none. */
  readonly status: (name: string) => Effect.Effect<Option.Option<RunStatus>>
}

/** Every Account's sandbox. A failure of the machine below is a defect. */
export class Sandbox extends Context.Service<
  Sandbox,
  {
    /** The Account's sandbox, made when it has none, found when it has. */
    readonly ensure: (accountId: string) => Effect.Effect<Box>
    /**
     * The command line that runs Claude Code in a sandbox, before its arguments: `claude` on Blaxel,
     * whose image holds it; on this machine, a fake agent unless the environment asks for Claude Code.
     */
    readonly agent: ReadonlyArray<string>
    /**
     * The origin a sandbox reaches the app at, given the one a request reached it at: on Blaxel, the
     * deployment's own, the one host its network lets through; on this machine, the request's.
     */
    readonly origin: (requested: string) => string
  }
>()('hexframe/Sandbox') {}

/** The folder of the home that holds the System, read-only. */
export const systemFolder = 'system'

/** The folder of the home a process writes in, its HOME a folder of its own there. */
export const workFolder = 'work'

/**
 * A process's HOME, from the sandbox's home: its own folder of the work folder, by its name, which
 * must be a plain word (`turn-<id>`). Throws, a defect, on any other: every name is the app's own.
 */
export function homeOf(name: string): string {
  if (!/^[\w-]+$/.test(name))
    throw new Error(`A process's name is a plain word: ${JSON.stringify(name)}`)
  return `${workFolder}/${name}`
}

/**
 * The name of an Account's sandbox: a hash of the Account's id, so the id never leaves the app, and of
 * the namespace, so a preview and production never share one for an Account the two databases hold.
 */
export function sandboxName(namespace: string, accountId: string): string {
  const hash = createHash('sha256').update(`${namespace}\n${accountId}`).digest('hex')
  return `hexframe-${hash.slice(0, 32)}`
}

/**
 * A path from a folder, normalized: relative, never leaving the folder. Throws, a defect, on any other,
 * since every path the app writes is its own.
 */
export function inside(path: string): string {
  const normalized = posix.normalize(path)
  if (
    path === '' ||
    posix.isAbsolute(path) ||
    normalized === '..' ||
    normalized.startsWith('../')
  ) {
    throw new Error(`A sandbox path must stay inside its folder: ${JSON.stringify(path)}`)
  }
  return normalized
}

/**
 * A path from the home, outside the System folder, normalized. Throws, a defect, on one inside it,
 * which only `replaceSystem` writes, or leaving the home.
 */
export function outsideTheSystem(path: string): string {
  const normalized = inside(path)
  if (normalized === systemFolder || normalized.startsWith(`${systemFolder}/`)) {
    throw new Error(`The System folder is written whole, never one file: ${JSON.stringify(path)}`)
  }
  return normalized
}
