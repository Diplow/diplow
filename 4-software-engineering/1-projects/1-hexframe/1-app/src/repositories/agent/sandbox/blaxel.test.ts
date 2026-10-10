import { describe, expect, it } from '@effect/vitest'
import { ConfigProvider, Effect, Exit } from 'effect'

import { deployment, layer } from './blaxel'
import { Sandbox } from './sandbox'

// The Blaxel layer without Blaxel: where its sandboxes are named and what they may reach, read from
// Vercel's variables, and the layer built without its credentials. Nothing here calls Blaxel.

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
    'a preview names them in its branch’s host and lets them reach its own hosts alone',
    () =>
      Effect.gen(function* () {
        expect(yield* withEnv({ ...vercel, VERCEL_ENV: 'preview' })(deployment)).toEqual({
          namespace: 'hexframe-app-git-feat-team.vercel.app',
          hosts: ['hexframe-abc123-team.vercel.app', 'hexframe-app-git-feat-team.vercel.app'],
        })
      }),
  )

  it.effect('production names them in its domain, which they reach too', () =>
    Effect.gen(function* () {
      expect(yield* withEnv({ ...vercel, VERCEL_ENV: 'production' })(deployment)).toEqual({
        namespace: 'hexframe.ai',
        hosts: [
          'hexframe-abc123-team.vercel.app',
          'hexframe-app-git-feat-team.vercel.app',
          'hexframe.ai',
        ],
      })
    }),
  )

  it.effect('off Vercel, in `local`, reaching localhost, which a sandbox never does', () =>
    Effect.gen(function* () {
      expect(yield* withEnv({})(deployment)).toEqual({ namespace: 'local', hosts: ['localhost'] })
    }),
  )
})

describe('the layer without Blaxel’s credentials', () => {
  it.effect(
    'builds, so the app runs, and ensuring a sandbox is a defect naming what is missing',
    () =>
      Effect.gen(function* () {
        const exit = yield* Sandbox.use((sandbox) => sandbox.ensure('account-1')).pipe(
          Effect.provide(layer),
          withEnv({}),
          Effect.exit,
        )
        expect(Exit.hasDies(exit)).toBe(true)
        expect(String(Exit.isFailure(exit) ? exit.cause : '')).toContain('BL_API_KEY')
      }),
  )
})
