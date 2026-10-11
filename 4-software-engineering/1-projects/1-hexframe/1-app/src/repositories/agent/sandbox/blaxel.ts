// The sandbox on Blaxel, the one module of the app that imports `@blaxel/core`
// (dependency-cruiser.config.ts, `sdks`): each Account's sandbox created by its name from the image
// that holds Claude Code, deleted after a week idle, its egress through Blaxel's proxy to the app's
// hosts alone; its System folder written in one call, root's and read-only; its processes started
// detached as a user of their own, who can't write it, kept awake for their time, interrupted by a
// SIGINT sent from inside, then killed.
import { initialize, ResponseError, SandboxInstance } from '@blaxel/core'
import { Cause, Config, Duration, Effect, Layer, Option, Redacted } from 'effect'

import {
  type Box,
  ended,
  inside,
  homeOf,
  outsideTheSystem,
  type Run,
  type RunStatus,
  Sandbox,
  type SandboxFile,
  sandboxName,
  systemFolder,
  workFolder,
} from './sandbox'

/** Blaxel's image with Claude Code on its PATH, and Node, which a Turn's launcher runs on. */
const image = 'blaxel/claude-code:latest'

/** Claude Code, as the image holds it. */
const agent = ['claude']

/** How long a sandbox stays idle before it is deleted. */
const idleLifetime = '7d'

/** The folder every path of a sandbox is from. */
const home = '/blaxel/hexframe'

/**
 * The user a process runs as, made in each sandbox: root runs the layer's own commands and owns the
 * System folder, which its modes alone could not keep from root.
 */
const user = 'hexframe'

/** How long a stop waits for a process it interrupted before killing it. */
const grace = Duration.seconds(10)

/** How long a command the layer runs itself (a wipe, a mode change, a signal) may take. */
const chore = 60

/** What the app's sandboxes reach: these hosts, through Blaxel's proxy, which the firewall enforces. */
function networkOf(hosts: ReadonlyArray<string>) {
  return { proxy: { allowedDomains: [...hosts] }, firewall: { rulesets: ['proxy'] } }
}

/** Whether two lists hold the same strings, in any order. */
const sameSet = (one: ReadonlyArray<string> | undefined, other: ReadonlyArray<string>) => {
  const now = new Set(one ?? [])
  return now.size === new Set(other).size && other.every((item) => now.has(item))
}

/**
 * Whether a sandbox with this network must have it set again to reach `hosts` alone: unless its
 * proxy allows exactly these hosts and its firewall holds exactly the `proxy` ruleset, in any order.
 * A sandbox made before its network was set, which has none, must.
 */
export function networkDrifted(
  current: SandboxInstance['spec']['network'],
  hosts: ReadonlyArray<string>,
) {
  const wanted = networkOf(hosts)
  return (
    !sameSet(current?.proxy?.allowedDomains, wanted.proxy.allowedDomains) ||
    !sameSet(current?.firewall?.rulesets, wanted.firewall.rulesets)
  )
}

/** A string in single quotes, for a shell. */
const quoted = (text: string) => `'${text.replaceAll("'", `'\\''`)}'`

/**
 * The shell that makes `name` a user of the sandbox unless it is one. Two `ensure`s of a fresh sandbox
 * may both find no such user and both run `useradd`: the one that loses finds it made, and goes on.
 */
export const userMade = (name: string) => {
  const exists = `id -u ${quoted(name)} >/dev/null 2>&1`
  return `(${exists} || useradd --no-create-home --shell /bin/sh ${quoted(name)} || ${exists})`
}

/** A call to Blaxel; its failure is a defect, the sandbox's errand having failed. */
const blaxel = <A>(call: () => Promise<A>) => Effect.orDie(Effect.tryPromise(call))

/** Whether Blaxel answered that what was asked for does not exist. */
const isMissing = (error: unknown) => error instanceof ResponseError && error.status === 404

/** Runs a command the layer needs, to its end; a non-zero exit is a defect. */
const chored = (sandbox: SandboxInstance, command: string) =>
  Effect.flatMap(
    blaxel(() =>
      sandbox.process.exec({ command, waitForCompletion: true, timeout: chore, workingDir: '/' }),
    ),
    (done) =>
      'exitCode' in done && done.exitCode !== 0
        ? Effect.die(new Error(`A sandbox chore exited ${String(done.exitCode)}: ${command}`))
        : Effect.void,
  )

/** The process of this name, as Blaxel reports it; none when the sandbox knows none. */
const processOf = (sandbox: SandboxInstance, name: string) =>
  blaxel(() =>
    sandbox.process.get(name).catch((error: unknown) => {
      if (isMissing(error)) return undefined
      throw error
    }),
  )

/**
 * A process's state as Blaxel reports it, read by the rule the fake reads one by (`ended`): Blaxel's
 * kill is a SIGKILL, its own stop a stop, and a process that ended by itself by its exit code.
 */
export function statusFrom({
  status,
  exitCode,
}: {
  readonly status: 'running' | 'completed' | 'failed' | 'stopped' | 'killed'
  readonly exitCode: number
}): RunStatus {
  if (status === 'running' || status === 'stopped') return { state: status }
  return status === 'killed' ? ended({ signal: 'SIGKILL' }) : ended({ code: exitCode })
}

/** One Account's sandbox on Blaxel. */
function boxOf(sandbox: SandboxInstance, name: string): Box {
  const system = `${home}/${systemFolder}`

  const stop = (processName: string) =>
    Effect.gen(function* () {
      const found = yield* processOf(sandbox, processName)
      if (found?.status !== 'running') return
      // Blaxel's own stop sends no SIGINT: the signal is sent from inside, to the process's own pid.
      if (/^\d+$/.test(found.pid)) {
        yield* chored(sandbox, `kill -INT ${found.pid} 2>/dev/null || true`)
      }
      const waited = yield* blaxel(() =>
        sandbox.process.wait(processName, { maxWait: Duration.toMillis(grace) }).catch(() => found),
      )
      if (waited.status === 'running') yield* blaxel(() => sandbox.process.kill(processName))
    })

  return {
    name,
    home,
    replaceSystem: (files: ReadonlyArray<SandboxFile>) =>
      Effect.gen(function* () {
        const tree = files.map(({ path, content }) => ({ path: inside(path), content }))
        yield* chored(
          sandbox,
          `chmod -R u+w ${quoted(system)} 2>/dev/null; rm -rf ${quoted(system)} && mkdir -p ${quoted(system)}`,
        )
        if (tree.length > 0) yield* blaxel(() => sandbox.fs.writeTree(tree, system))
        yield* chored(sandbox, `chown -R 0:0 ${quoted(system)} && chmod -R a-w ${quoted(system)}`)
      }),
    write: ({ path, content }: SandboxFile) =>
      Effect.flatMap(
        Effect.sync(() => outsideTheSystem(path)),
        (normalized) => blaxel(() => sandbox.fs.write(`${home}/${normalized}`, content)),
      ),
    start: (run: Run) =>
      Effect.gen(function* () {
        // Its own HOME, everything else the work folder held gone first.
        const work = quoted(`${home}/${workFolder}`)
        const own = quoted(`${home}/${homeOf(run.name)}`)
        yield* chored(
          sandbox,
          `find ${work} -mindepth 1 -maxdepth 1 ! -name ${quoted(run.name)} -exec rm -rf {} + && ` +
            `mkdir -p ${own} && chown ${user} ${own}`,
        )
        yield* blaxel(() =>
          sandbox.process.exec({
            name: run.name,
            // setpriv drops to the agent's user and execs, so the pid Blaxel reports stays the one
            // a stop signals.
            command: `setpriv --reuid=${user} --regid=${user} --init-groups -- sh -c ${quoted(run.command)}`,
            workingDir: `${home}/${inside(run.workingDir)}`,
            env: { HOME: `${home}/${homeOf(run.name)}`, ...run.env },
            keepAlive: true,
            timeout: run.timeoutSeconds,
          }),
        )
      }),
    stop,
    status: (processName: string) =>
      Effect.map(processOf(sandbox, processName), (found) =>
        Option.map(Option.fromNullishOr(found), statusFrom),
      ),
  }
}

/**
 * Every Account's sandbox on Blaxel, in `namespace`, reaching `hosts` alone, and the app at its
 * `canonical` host, the one Vercel's protection leaves open in production. A sandbox made before the
 * hosts changed has its network set again when it is ensured.
 */
function makeBlaxel({
  namespace,
  hosts,
  canonical,
}: {
  readonly namespace: string
  readonly hosts: ReadonlyArray<string>
  readonly canonical: string | undefined
}): Sandbox['Service'] {
  const network = networkOf(hosts)
  return {
    agent,
    origin: (requested) => (canonical === undefined ? requested : `https://${canonical}`),
    ensure: (accountId: string) =>
      Effect.gen(function* () {
        const name = sandboxName(namespace, accountId)
        const sandbox = yield* blaxel(() =>
          SandboxInstance.createIfNotExists({
            name,
            image,
            lifecycle: {
              expirationPolicies: [{ type: 'ttl-idle', value: idleLifetime, action: 'delete' }],
            },
            network,
            labels: { app: 'hexframe' },
          }),
        )
        if (networkDrifted(sandbox.spec.network, hosts)) {
          yield* blaxel(() => SandboxInstance.updateNetwork(name, { network }))
        }
        // The home is root's, so the agent's user renames nothing in it; the work folder is its own.
        const work = quoted(`${home}/${workFolder}`)
        yield* chored(
          sandbox,
          `mkdir -p ${work} && chown 0:0 ${quoted(home)} && chmod 755 ${quoted(home)} && ` +
            `${userMade(user)} && ` +
            `chown ${user} ${work} && command -v setpriv >/dev/null`,
        )
        return boxOf(sandbox, name)
      }),
  }
}

/**
 * The hosts a Vercel deployment answers on, which its sandboxes may reach, and the one its sandboxes
 * are named in and reach the app at, `canonical`: production's domain, else its branch's, else its
 * own. Off Vercel, `localhost`, which a sandbox never reaches, the namespace `local`, and no host of
 * its own.
 */
export const deployment = Effect.gen(function* () {
  if (Option.isNone(yield* Config.option(Config.String('VERCEL')))) {
    return { namespace: 'local', hosts: ['localhost'], canonical: undefined }
  }
  const { environment, own, branch, production } = yield* Config.all({
    environment: Config.String('VERCEL_ENV'),
    own: Config.String('VERCEL_URL'),
    branch: Config.option(Config.String('VERCEL_BRANCH_URL')),
    production: Config.String('VERCEL_PROJECT_PRODUCTION_URL'),
  })
  const canonical = environment === 'production' ? production : Option.getOrElse(branch, () => own)
  return {
    namespace: canonical,
    hosts: [...new Set([own, ...Option.toArray(branch), canonical])],
    canonical,
  }
})

/** Whether Blaxel's workspace and key are both set, an empty variable counting as none. */
export const hasCredentials = (env: Readonly<Record<string, string | undefined>>) =>
  (env.BL_WORKSPACE ?? '') !== '' && (env.BL_API_KEY ?? '') !== ''

/** The service when Blaxel can't be had: the app runs, and ensuring a sandbox is a defect. */
const unavailable = (why: Error): Sandbox['Service'] => ({
  ensure: () => Effect.die(why),
  agent,
  origin: (requested) => requested,
})

/**
 * The sandbox on Blaxel, its workspace and key from `BL_WORKSPACE` and `BL_API_KEY`. It always
 * builds, so a sandbox that can't be had never takes the rest of the app down: without credentials,
 * or with a setup that failed, ensuring a sandbox is a defect saying why.
 */
export const layer = Layer.effect(Sandbox)(
  Effect.gen(function* () {
    const workspace = yield* Config.withDefault(Config.String('BL_WORKSPACE'), '')
    const apiKey = yield* Config.withDefault(Config.Redacted('BL_API_KEY'), Redacted.make(''))
    if (!hasCredentials({ BL_WORKSPACE: workspace, BL_API_KEY: Redacted.value(apiKey) })) {
      return unavailable(new Error('Blaxel is not configured: BL_WORKSPACE, BL_API_KEY'))
    }
    yield* Effect.sync(() => {
      initialize({ workspace, apiKey: Redacted.value(apiKey) })
    })
    return makeBlaxel(yield* deployment)
  }).pipe(
    Effect.catchCause((cause) =>
      Effect.succeed(
        unavailable(new Error('Blaxel could not be set up', { cause: Cause.squash(cause) })),
      ),
    ),
  ),
)
