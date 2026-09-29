import { describe, expect, it } from 'vitest'

import { isTopic, logs, verbosityFor } from './levels'

describe('the verbosity levels', () => {
  it('logs page visits, actions, calls and errors at every level', () => {
    for (const topic of ['page', 'action', 'call', 'error'] as const) {
      expect(logs('high', topic, 'production')).toBe(true)
    }
  })

  it('adds domain calls, state actions and bus messages at medium', () => {
    for (const topic of ['domain', 'state', 'bus'] as const) {
      expect(logs('high', topic, 'production')).toBe(false)
      expect(logs('medium', topic, 'production')).toBe(true)
    }
  })

  it('adds information, repository calls and renders at low', () => {
    for (const topic of ['info', 'repository', 'render'] as const) {
      expect(logs('medium', topic, 'development')).toBe(false)
      expect(logs('low', topic, 'development')).toBe(true)
    }
  })

  it('logs renders in development only, whatever the level', () => {
    expect(logs('low', 'render', 'preview')).toBe(false)
    expect(logs('low', 'render', 'production')).toBe(false)
    expect(logs('low', 'info', 'production')).toBe(true)
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
