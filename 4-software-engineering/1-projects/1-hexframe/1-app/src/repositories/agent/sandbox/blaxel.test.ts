import { spawnSync } from 'node:child_process'
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from '@effect/vitest'
import { ConfigProvider, Effect, Exit } from 'effect'

import { deployment, layer, networkDrifted, statusFrom, userMade } from './blaxel'
import { Sandbox } from './sandbox'

// The Blaxel layer without Blaxel: where its sandboxes are named and what they may reach, read from
// Vercel's variables, when a sandbox's network is set again, how a process's state reads, the shell
// that makes the agent's user, run on this machine against stand-ins for `id` and `useradd`, and the
// layer built without its credentials. Nothing here calls Blaxel.

/** Runs an effect with these variables as its whole environment. */
const withEnv =
  (env: Record<string, string>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    effect.pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord(env))))

const vercel = {
  VERCEL: '1',
  VERCEL_URL: 'hexframe-abc123-team.vercel.app',
  VERCEL_BRANCH_URL: 'hexframe-app-git-feat-team.vercel.app',
  VERCEL_PROJECT_PRODUCTION_URL: 'hexframe.ai',
}

describe('where a deployment’s sandboxes live', () => {
  it.effect(
    'a preview names them in its branch’s host, where they reach the app, and lets them reach its own hosts alone',
    () =>
      Effect.gen(function* () {
        expect(yield* withEnv({ ...vercel, VERCEL_ENV: 'preview' })(deployment)).toEqual({
          namespace: 'hexframe-app-git-feat-team.vercel.app',
          hosts: ['hexframe-abc123-team.vercel.app', 'hexframe-app-git-feat-team.vercel.app'],
          canonical: 'hexframe-app-git-feat-team.vercel.app',
        })
      }),
  )

  it.effect('production names them in its domain, where they reach the app', () =>
    Effect.gen(function* () {
      expect(yield* withEnv({ ...vercel, VERCEL_ENV: 'production' })(deployment)).toEqual({
        namespace: 'hexframe.ai',
        hosts: [
          'hexframe-abc123-team.vercel.app',
          'hexframe-app-git-feat-team.vercel.app',
          'hexframe.ai',
        ],
        canonical: 'hexframe.ai',
      })
    }),
  )

  it.effect('off Vercel, in `local`, reaching localhost, which a sandbox never does', () =>
    Effect.gen(function* () {
      expect(yield* withEnv({})(deployment)).toEqual({
        namespace: 'local',
        hosts: ['localhost'],
        canonical: undefined,
      })
    }),
  )
})

describe('the layer without Blaxel’s credentials', () => {
  it.effect(
    'builds, empty variables counting as none, and ensuring a sandbox is then a defect naming them',
    () =>
      Effect.gen(function* () {
        const envs: ReadonlyArray<Record<string, string>> = [
          {},
          { BL_WORKSPACE: '', BL_API_KEY: '' },
          { BL_WORKSPACE: 'w', BL_API_KEY: '' },
        ]
        for (const env of envs) {
          const exit = yield* Sandbox.use((sandbox) => sandbox.ensure('account-1')).pipe(
            Effect.provide(layer),
            withEnv(env),
            Effect.exit,
          )
          expect(Exit.hasDies(exit), JSON.stringify(env)).toBe(true)
          expect(String(Exit.isFailure(exit) ? exit.cause : '')).toContain('BL_API_KEY')
        }
      }),
  )

  it.effect(
    'builds when its setup fails too, ensuring then a defect saying it could not be set up',
    () =>
      Effect.gen(function* () {
        const exit = yield* Sandbox.use((sandbox) => sandbox.ensure('account-1')).pipe(
          Effect.provide(layer),
          // On Vercel, its hosts missing: the setup fails after the credentials were read.
          withEnv({ BL_WORKSPACE: 'w', BL_API_KEY: 'k', VERCEL: '1' }),
          Effect.exit,
        )
        expect(Exit.hasDies(exit)).toBe(true)
        expect(String(Exit.isFailure(exit) ? exit.cause : '')).toContain('could not be set up')
      }),
  )
})

describe('a sandbox’s network', () => {
  const hosts = ['hexframe-abc123-team.vercel.app', 'hexframe.ai']

  it('is set again unless its proxy allows exactly its hosts and its firewall holds the proxy', () => {
    const network = (allowedDomains: ReadonlyArray<string>, rulesets = ['proxy']) => ({
      proxy: { allowedDomains: [...allowedDomains] },
      firewall: { rulesets },
    })
    expect(networkDrifted(network([...hosts].reverse()), hosts)).toBe(false)
    expect(networkDrifted(undefined, hosts)).toBe(true)
    expect(networkDrifted({}, hosts)).toBe(true)
    expect(networkDrifted(network([]), hosts)).toBe(true)
    expect(networkDrifted(network(['hexframe.ai']), hosts)).toBe(true)
    expect(networkDrifted(network([...hosts, 'example.com']), hosts)).toBe(true)
    expect(networkDrifted(network(['old-preview.vercel.app', 'hexframe.ai']), hosts)).toBe(true)
    expect(networkDrifted(network(hosts, []), hosts)).toBe(true)
    expect(networkDrifted(network(hosts, ['default']), hosts)).toBe(true)
  })
})

describe('a process’s state, as Blaxel reports it', () => {
  it('reads as the fake reads it: by how the process ended', () => {
    expect(statusFrom({ status: 'running', exitCode: 0 })).toEqual({ state: 'running' })
    expect(statusFrom({ status: 'completed', exitCode: 0 })).toEqual({
      state: 'completed',
      exitCode: 0,
    })
    expect(statusFrom({ status: 'failed', exitCode: 3 })).toEqual({ state: 'failed', exitCode: 3 })
    expect(statusFrom({ status: 'failed', exitCode: 130 })).toEqual({ state: 'stopped' })
    expect(statusFrom({ status: 'killed', exitCode: -1 })).toEqual({ state: 'killed' })
    expect(statusFrom({ status: 'stopped', exitCode: -1 })).toEqual({ state: 'stopped' })
  })
})

describe('the agent’s user, made in a sandbox', () => {
  /**
   * Runs the shell that makes `hexframe` with stand-ins for `id`, which finds the user once `$MADE` is
   * there, `exists` saying whether it is at first, and `useradd`, which runs as `useradd` says, in
   * shell builtins alone; answers its exit code.
   */
  async function madeWith(useradd: string, exists = false) {
    const bin = await mkdtemp(join(tmpdir(), 'hexframe-useradd-test-'))
    const made = join(bin, 'made')
    const stand = async (name: string, script: string) => {
      await writeFile(join(bin, name), `#!/bin/sh\n${script}\n`)
      await chmod(join(bin, name), 0o755)
    }
    await stand('id', `test -e '${made}'`)
    await stand('useradd', useradd.replaceAll('$MADE', `'${made}'`))
    if (exists) await writeFile(made, '')
    const { status } = spawnSync('/bin/sh', ['-c', userMade('hexframe')], {
      env: { PATH: bin },
    })
    await rm(bin, { recursive: true, force: true })
    return status
  }

  it('is made when it is not, and left as it is when it is', async () => {
    expect(await madeWith(': > $MADE')).toBe(0)
    expect(await madeWith('exit 1', true)).toBe(0)
  })

  it('goes on when another ensure made it first, its own useradd refused', async () => {
    // The other ensure makes it between this one's `id` and its `useradd`, which fails as it exists.
    expect(await madeWith(': > $MADE; exit 9')).toBe(0)
  })

  it('fails when useradd fails and no user was made', async () => {
    expect(await madeWith('exit 1')).not.toBe(0)
  })
})
