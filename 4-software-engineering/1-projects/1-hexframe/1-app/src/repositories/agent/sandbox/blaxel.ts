// The sandbox on Blaxel, the one module of the app that imports `@blaxel/core`
// (dependency-cruiser.config.ts, `sdks`): each Account's sandbox created by its name from the image
// that holds Claude Code, deleted after a week idle, its egress through Blaxel's proxy to the app's
// hosts alone; its System folder written in one call and made read-only; its processes started
// detached, kept awake for their time, interrupted by a SIGINT sent from inside, then killed.
import { initialize, ResponseError, SandboxInstance } from '@blaxel/core'
import { Config, Duration, Effect, Layer, Option, Redacted } from 'effect'

import {
  type Box,
  idleLifetime,
  inside,
  outsideTheSystem,
  type Run,
  type RunStatus,
  Sandbox,
  type SandboxFile,
  sandboxName,
  systemFolder,
} from './sandbox'

/** Blaxel's image with Claude Code on its PATH. */
const image = 'blaxel/claude-code:latest'

/** The folder every path of a sandbox is from. */
const home = '/blaxel/hexframe'

/** How long a stop waits for a process it interrupted before killing it. */
const grace = Duration.seconds(10)

/** How long a command the layer runs itself (a wipe, a mode change, a signal) may take. */
const chore = 60

/** What the app's sandboxes reach: these hosts, through Blaxel's proxy, which the firewall enforces. */
function networkOf(hosts: ReadonlyArray<string>) {
  return { proxy: { allowedDomains: [...hosts] }, firewall: { rulesets: ['proxy'] } }
}

/** A string in single quotes, for a shell. */
const quoted = (text: string) => `'${text.replaceAll("'", `'\\''`)}'`

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

/** Where a process stands, as Blaxel reports it, its exit code once it ended by itself. */
const statusOf = (sandbox: SandboxInstance, name: string) =>
  Effect.orDie(
    Effect.tryPromise({
      try: async (): Promise<Option.Option<RunStatus>> => {
        const found = await sandbox.process.get(name).catch((error: unknown) => {
          if (isMissing(error)) return undefined
          throw error
        })
        if (found === undefined) return Option.none()
        const ended = found.status === 'completed' || found.status === 'failed'
        return Option.some(
          ended ? { state: found.status, exitCode: found.exitCode } : { state: found.status },
        )
      },
      catch: (error) => error,
    }),
  )

/** One Account's sandbox on Blaxel. */
function boxOf(sandbox: SandboxInstance, name: string): Box {
  const system = `${home}/${systemFolder}`

  const stop = (processName: string) =>
    Effect.gen(function* () {
      const found = yield* blaxel(() => sandbox.process.get(processName))
      if (found.status !== 'running') return
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
        yield* chored(sandbox, `chmod -R a-w ${quoted(system)}`)
      }),
    write: ({ path, content }: SandboxFile) =>
      Effect.flatMap(
        Effect.sync(() => outsideTheSystem(path)),
        (normalized) => blaxel(() => sandbox.fs.write(`${home}/${normalized}`, content)),
      ),
    start: (run: Run) =>
      Effect.asVoid(
        blaxel(() =>
          sandbox.process.exec({
            name: run.name,
            command: run.command,
            workingDir: `${home}/${inside(run.workingDir)}`,
            env: { ...run.env },
            keepAlive: true,
            timeout: run.timeoutSeconds,
          }),
        ),
      ),
    stop,
    status: (processName: string) => statusOf(sandbox, processName),
  }
}

/**
 * Every Account's sandbox on Blaxel, in `namespace`, reaching `hosts` alone. A sandbox made before
 * the hosts changed has its network set again when it is ensured.
 */
function makeBlaxel({
  namespace,
  hosts,
}: {
  readonly namespace: string
  readonly hosts: ReadonlyArray<string>
}): Sandbox['Service'] {
  const network = networkOf(hosts)
  return {
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
        const allowed = sandbox.spec.network?.proxy?.allowedDomains ?? []
        if (allowed.join(',') !== network.proxy.allowedDomains.join(',')) {
          yield* blaxel(() => SandboxInstance.updateNetwork(name, { network }))
        }
        yield* chored(sandbox, `mkdir -p ${quoted(home)}`)
        return boxOf(sandbox, name)
      }),
  }
}

/**
 * The hosts a Vercel deployment answers on, which its sandboxes may reach, and the one its sandboxes
 * are named in: production's domain, else its branch's, else its own. Off Vercel, `localhost`, which
 * a sandbox never reaches, and the namespace `local`.
 */
export const deployment = Effect.gen(function* () {
  if (Option.isNone(yield* Config.option(Config.String('VERCEL')))) {
    return { namespace: 'local', hosts: ['localhost'] }
  }
  const { environment, own, branch, production } = yield* Config.all({
    environment: Config.String('VERCEL_ENV'),
    own: Config.String('VERCEL_URL'),
    branch: Config.option(Config.String('VERCEL_BRANCH_URL')),
    production: Config.String('VERCEL_PROJECT_PRODUCTION_URL'),
  })
  const canonical = environment === 'production' ? production : Option.getOrElse(branch, () => own)
  return { namespace: canonical, hosts: [...new Set([own, ...Option.toArray(branch), canonical])] }
})

/**
 * The sandbox on Blaxel, its workspace and key from `BL_WORKSPACE` and `BL_API_KEY`. Without them the
 * layer still builds, so the rest of the app runs, and ensuring a sandbox is a defect.
 */
export const layer = Layer.effect(Sandbox)(
  Effect.gen(function* () {
    const credentials = yield* Config.option(
      Config.all({
        workspace: Config.String('BL_WORKSPACE'),
        apiKey: Config.Redacted('BL_API_KEY'),
      }),
    )
    if (Option.isNone(credentials)) {
      return {
        ensure: () => Effect.die(new Error('Blaxel is not configured: BL_WORKSPACE, BL_API_KEY')),
      }
    }
    const { workspace, apiKey } = credentials.value
    initialize({ workspace, apiKey: Redacted.value(apiKey) })
    return makeBlaxel(yield* deployment)
  }),
).pipe(Layer.orDie)
