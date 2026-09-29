import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import { afterEach, beforeEach, vi } from 'vitest'

import { Analytics, analytics } from './posthog-server'

// PostHog's Node client, recorded: what it was asked to capture, and how often it read a flag.
const posthog = vi.hoisted(() => ({
  captured: [] as Array<unknown>,
  evaluations: 0,
}))

vi.mock('posthog-node', () => ({
  PostHog: class {
    capture(message: unknown) {
      posthog.captured.push(message)
    }
    evaluateFlags() {
      posthog.evaluations += 1
      return Promise.resolve({ getFlag: () => 'low' })
    }
    flush() {
      return Promise.resolve()
    }
    shutdown() {
      return Promise.resolve()
    }
  },
}))

beforeEach(() => {
  posthog.captured = []
  posthog.evaluations = 0
  vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test')
  vi.stubEnv('VITE_POSTHOG_HOST', 'https://eu.i.posthog.com')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('PostHog on the server', () => {
  it.effect('records a signed-out request without a person profile, a signed-in one with', () =>
    Effect.gen(function* () {
      const { capture } = yield* Analytics
      capture({ event: 'call', distinctId: 'req-1', anonymous: true, properties: { scope: 'x' } })
      capture({ event: 'call', distinctId: 'a-1', anonymous: false, properties: { scope: 'x' } })
      expect(posthog.captured).toEqual([
        {
          event: 'call',
          distinctId: 'req-1',
          properties: { scope: 'x', $process_person_profile: false },
        },
        { event: 'call', distinctId: 'a-1', properties: { scope: 'x' } },
      ])
    }).pipe(Effect.provide(analytics)),
  )

  it.effect("reads one person's flag once, then keeps it", () =>
    Effect.gen(function* () {
      const { flag } = yield* Analytics
      expect(yield* flag('verbosity', 'a-1')).toBe('low')
      expect(yield* flag('verbosity', 'a-1')).toBe('low')
      expect(posthog.evaluations).toBe(1)
    }).pipe(Effect.provide(analytics)),
  )

  it.effect('sends nothing and serves no flag without a key', () => {
    vi.stubEnv('VITE_POSTHOG_KEY', '')
    return Effect.gen(function* () {
      const { capture, flag } = yield* Analytics
      capture({ event: 'call', distinctId: 'req-1', anonymous: true, properties: {} })
      expect(yield* flag('verbosity', 'a-1')).toBeUndefined()
      expect(posthog.captured).toEqual([])
    }).pipe(Effect.provide(analytics))
  })
})
