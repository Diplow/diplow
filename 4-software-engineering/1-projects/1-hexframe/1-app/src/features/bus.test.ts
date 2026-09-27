// @vitest-environment happy-dom
import { cleanup, renderHook } from '@testing-library/react'
import { Schema } from 'effect'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { publish, receive, useFact } from './bus'

// Two facts, named for the test rather than in a domain's language.
class DevHappened extends Schema.TaggedClass<DevHappened>()('DevHappened', { n: Schema.Number }) {}
class DevOther extends Schema.TaggedClass<DevOther>()('DevOther', {}) {}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** A mounted component reacting to `DevHappened`, and what it saw. */
function subscribed() {
  const seen: Array<DevHappened> = []
  const hook = renderHook(() => {
    useFact(DevHappened, (fact) => seen.push(fact))
  })
  return { seen, unmount: hook.unmount }
}

describe('the client bus', () => {
  it('tells a subscribed feature about the facts its schema accepts, and no other', () => {
    const { seen } = subscribed()
    publish(new DevHappened({ n: 1 }))
    publish(new DevOther())
    expect(seen).toEqual([new DevHappened({ n: 1 })])
  })

  it('stops telling a feature once it unmounts', () => {
    const { seen, unmount } = subscribed()
    unmount()
    publish(new DevHappened({ n: 1 }))
    expect(seen).toEqual([])
  })

  it('still tells the other features when one throws while reacting', () => {
    const report = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    renderHook(() => {
      useFact(DevHappened, () => {
        throw new Error('a bug in a feature')
      })
    })
    const { seen } = subscribed()
    publish(new DevHappened({ n: 1 }))
    expect(seen).toEqual([new DevHappened({ n: 1 })])
    expect(report).toHaveBeenCalledOnce()
  })

  it('decodes a fact crossing into the client by its schema', () => {
    const { seen } = subscribed()
    receive(DevHappened, { _tag: 'DevHappened', n: 2 })
    expect(seen).toEqual([new DevHappened({ n: 2 })])
    expect(seen[0]).toBeInstanceOf(DevHappened)
  })

  it('drops and reports a fact its schema refuses', () => {
    const report = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { seen } = subscribed()
    receive(DevHappened, { _tag: 'DevHappened', n: 'two' })
    expect(seen).toEqual([])
    expect(report).toHaveBeenCalledOnce()
  })

  it('logs every fact it carries at medium', () => {
    const log = vi.spyOn(console, 'debug').mockImplementation(() => undefined)
    publish(new DevOther())
    expect(log).toHaveBeenCalledWith('DevOther published', { bus: 'client', verbosity: 'medium' })
  })
})
