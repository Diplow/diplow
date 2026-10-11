import type { AnyRouter } from '@tanstack/react-router'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { forget, identify, startObservability } from './client'

// PostHog in the browser, as a stand-in: who the device is, whether PostHog keeps it identified across
// loads (`$user_state`), and what it was asked to do.
const posthog = vi.hoisted(() => ({
  device: { distinctId: 'device-1', userState: 'anonymous' },
  asked: [] as Array<string>,
}))

vi.mock('posthog-js', () => ({
  default: {
    init: () => undefined,
    onFeatureFlags: () => undefined,
    capture: () => undefined,
    get_distinct_id: () => posthog.device.distinctId,
    get_property: (name: string) => (name === '$user_state' ? posthog.device.userState : undefined),
    identify: (distinctId: string) => {
      posthog.asked.push(`identify ${distinctId}`)
      posthog.device = { distinctId, userState: 'identified' }
    },
    reset: () => {
      posthog.asked.push('reset')
      posthog.device = { distinctId: 'device-2', userState: 'anonymous' }
    },
    getFeatureFlag: (key: string) => {
      posthog.asked.push(`flag ${key}`)
      return 'low'
    },
  },
}))
vi.mock('#/repositories/observability/sentry', () => ({
  startSentry: vi.fn(),
  captureError: vi.fn(),
}))

beforeAll(() => {
  vi.stubGlobal('window', {})
  vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test')
  vi.stubEnv('VITE_POSTHOG_HOST', 'https://eu.i.posthog.com')
  startObservability({} as AnyRouter)
})

beforeEach(() => {
  posthog.device = { distinctId: 'device-1', userState: 'anonymous' }
  posthog.asked = []
})

describe('the device PostHog ties to an Account', () => {
  it('reads no Account flag, and resets nothing, on an anonymous device', () => {
    forget()
    expect(posthog.asked).toEqual([])
  })

  it('ties a device to the Account signed in, then reads its flag', () => {
    identify('account-1')
    expect(posthog.asked).toEqual(['identify account-1', 'flag verbosity'])
  })

  it('does not tie a device again to the Account it is already tied to', () => {
    posthog.device = { distinctId: 'account-1', userState: 'identified' }
    identify('account-1')
    expect(posthog.asked).toEqual(['flag verbosity'])
  })

  it('unties a device once after a sign-out, and reads no flag after it', () => {
    posthog.device = { distinctId: 'account-1', userState: 'identified' }
    forget()
    forget()
    expect(posthog.asked).toEqual(['reset'])
  })
})
