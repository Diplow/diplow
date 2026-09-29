import { describe, expect, it } from 'vitest'

import { environmentOf, isTopic, logs, verbosityFor, type Topic } from './levels'

// STACK.md's table, written out: the least verbose level that logs each topic.
const table: ReadonlyArray<readonly [Topic, 'high' | 'medium' | 'low']> = [
  ['page', 'high'],
  ['action', 'high'],
  ['call', 'high'],
  ['error', 'high'],
  ['domain', 'medium'],
  ['state', 'medium'],
  ['bus', 'medium'],
  ['info', 'low'],
  ['repository', 'low'],
  ['render', 'low'],
]
const levels = ['high', 'medium', 'low'] as const
const environments = ['production', 'preview', 'development'] as const

describe('the verbosity levels', () => {
  it.each(table)('log %s from %s down, in every environment but a render', (topic, from) => {
    for (const verbosity of levels) {
      for (const environment of environments) {
        const verbose = levels.indexOf(verbosity) >= levels.indexOf(from)
        const expected = verbose && (topic !== 'render' || environment === 'development')
        expect(logs(verbosity, topic, environment), `${verbosity} in ${environment}`).toBe(expected)
      }
    }
  })

  it('logs at high in production, medium in previews and low in development', () => {
    expect(verbosityFor(undefined, 'production')).toBe('high')
    expect(verbosityFor(undefined, 'preview')).toBe('medium')
    expect(verbosityFor(undefined, 'development')).toBe('low')
  })

  it("raises one user's verbosity by their flag, never lowers it", () => {
    expect(verbosityFor('low', 'production')).toBe('low')
    expect(verbosityFor('medium', 'production')).toBe('medium')
    expect(verbosityFor('high', 'preview')).toBe('medium')
  })

  it('ignores a flag that is not a level', () => {
    expect(verbosityFor(true, 'production')).toBe('high')
    expect(verbosityFor('verbose', 'production')).toBe('high')
  })

  it('knows its topics and nothing else', () => {
    expect(isTopic('bus')).toBe(true)
    expect(isTopic('toString')).toBe(false)
    expect(isTopic(undefined)).toBe(false)
  })
})

describe('where the app runs', () => {
  it('is development under `pnpm dev`, wherever Vite runs', () => {
    expect(environmentOf('serve', undefined)).toBe('development')
    expect(environmentOf('serve', 'preview')).toBe('development')
  })

  it("is a preview when Vercel builds one, and production for any other build, a local one's too", () => {
    expect(environmentOf('build', 'preview')).toBe('preview')
    expect(environmentOf('build', 'production')).toBe('production')
    expect(environmentOf('build', undefined)).toBe('production')
  })
})
