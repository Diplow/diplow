import { describe, expect, it, layer } from '@effect/vitest'
import { ConfigProvider, Effect, Exit, Layer, Option } from 'effect'

import { TestDatabase } from '../database/testing'
import { Auth, HttpExchange, baseURLOf, localBaseURL, make, vercelHosts } from './auth'
import { testSecret } from './testing'

const branch = 'hexframe-app-git-fix-team.vercel.app'

/** A preview, as Vercel names its hosts. */
const preview = {
  environment: 'preview',
  deployment: 'hexframe-abc123-team.vercel.app',
  branch: Option.some(branch),
  production: 'hexframe.ai',
}

describe('the base URL', () => {
  it('lets a preview answer on its own URL and its branch’s, and falls back to its branch’s', () => {
    expect(baseURLOf(Option.some(preview))).toEqual({
      allowedHosts: ['hexframe-abc123-team.vercel.app', branch],
      fallback: `https://${branch}`,
      protocol: 'https',
    })
  })

  it('lets production answer on the project’s domain too, and falls back to it', () => {
    expect(baseURLOf(Option.some({ ...preview, environment: 'production' }))).toEqual({
      allowedHosts: ['hexframe-abc123-team.vercel.app', branch, 'hexframe.ai'],
      fallback: 'https://hexframe.ai',
      protocol: 'https',
    })
  })

  it('answers on localhost off Vercel', () => {
    expect(baseURLOf(Option.none())).toBe(localBaseURL)
  })
})

describe('the Vercel hosts', () => {
  const readFrom = (env: Record<string, string>) =>
    vercelHosts.pipe(
      Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord(env))),
      Effect.exit,
    )
  const onVercel = {
    VERCEL: '1',
    VERCEL_ENV: 'preview',
    VERCEL_URL: preview.deployment,
    VERCEL_BRANCH_URL: branch,
    VERCEL_PROJECT_PRODUCTION_URL: preview.production,
  }

  it.effect('are read from Vercel’s system variables', () =>
    Effect.gen(function* () {
      expect(yield* readFrom(onVercel)).toEqual(Exit.succeed(Option.some(preview)))
    }),
  )

  it.effect('are none off Vercel', () =>
    Effect.gen(function* () {
      expect(yield* readFrom({})).toEqual(Exit.succeed(Option.none()))
    }),
  )

  it.effect('fail on Vercel when one is missing, rather than falling back to localhost', () =>
    Effect.gen(function* () {
      const withoutDeployment: Record<string, string> = { ...onVercel }
      delete withoutDeployment.VERCEL_URL
      expect(Exit.isFailure(yield* readFrom(withoutDeployment))).toBe(true)
    }),
  )
})

/** A request from a page on the preview's branch URL, to it, as a browser sends it. */
function onBranch(cookies: Array<string>) {
  return HttpExchange.of({
    url: `https://${branch}/_serverFn`,
    headers: new Headers({
      host: branch,
      origin: `https://${branch}`,
      cookie: cookies.map((line) => line.split(';')[0]).join('; '),
      'x-forwarded-for': '10.1.0.1',
    }),
    setCookies: (set) => cookies.push(...set),
  })
}

const OnPreview = Layer.effect(Auth)(
  Effect.suspend(() => make(testSecret(), baseURLOf(Option.some(preview)))),
).pipe(Layer.provide(TestDatabase))

layer(OnPreview)('Better Auth on a preview', (it) => {
  it.effect('signs up from a page on the preview, whose next request holds the session', () =>
    Effect.gen(function* () {
      const auth = yield* Auth
      const cookies: Array<string> = []
      const credentials = { email: 'preview@example.com', password: 'correct horse battery' }
      const user = yield* auth
        .signUp(credentials)
        .pipe(Effect.provideService(HttpExchange, onBranch(cookies)))
      const session = yield* auth.session.pipe(
        Effect.provideService(HttpExchange, onBranch(cookies)),
      )
      expect(Option.getOrThrow(session).user).toEqual(user)
    }),
  )
})
