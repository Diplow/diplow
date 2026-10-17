// @vitest-environment happy-dom
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useCanvasState, type TileHex } from '#/front/ui/canvas/state/useCanvasState'
import type { TileNode } from '#/front/ui/canvas/view/tiles'

import { publish, receive, useFact } from './bus'
import { AskedAboutTile, Navigated } from './facts'

// The navigation fact as home publishes it: the canvas hands the route each gesture with the next
// view, the route publishes a `Navigated` for it, and a feature hears it through `useFact`. Which
// gesture each interaction names is the canvas's own test (`useCanvasState.test.ts`).

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const tile = (id: string, more: Partial<TileNode> = {}): TileNode => ({
  id,
  title: id,
  preview: '',
  ...more,
})

const system = tile('root', { branches: { 1: tile('a'), 4: tile('b') } })

/** A feature listening on the bus, and the navigation facts it heard. */
function listening() {
  const heard: Navigated[] = []
  renderHook(() => {
    useFact(Navigated, (fact) => heard.push(fact))
  })
  return heard
}

describe('the navigation fact', () => {
  it('is heard once per gesture, with the gesture and its Tile', () => {
    const heard = listening()
    const { result } = renderHook(() =>
      useCanvasState({
        system,
        view: { frame: 'children' },
        onViewChange: (_next, action) => {
          publish(new Navigated(action))
        },
      }),
    )
    const { state, actions } = result.current
    const tileOf = (key: string) => {
      const found = state.hexes.find(
        (hex): hex is TileHex => hex.kind === 'tile' && hex.key === key,
      )
      if (found === undefined) throw new Error(`No Tile is drawn under ${key}`)
      return found
    }
    const a = tileOf('tile:a')
    actions.click(a)
    actions.go(tileOf('tile:root'), 'show-context')
    actions.center(a, 'keyboard')
    expect(heard).toEqual([
      new Navigated({ gesture: 'expand', tile: 'a' }),
      new Navigated({ gesture: 'show-context', tile: 'root' }),
      new Navigated({ gesture: 'center', tile: 'a' }),
    ])
  })

  it('crosses into the client by its schema, a gesture the canvas does not name refused', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const heard = listening()
    receive(Navigated, { _tag: 'Navigated', gesture: 'center', tile: 'a' })
    receive(Navigated, { _tag: 'Navigated', gesture: 'zoomed', tile: 'a' })
    expect(heard).toEqual([new Navigated({ gesture: 'center', tile: 'a' })])
  })
})

describe('the fact of the agent asked from a menu', () => {
  it('is heard with its Tile, and the place a new Tile would take', () => {
    const heard: AskedAboutTile[] = []
    renderHook(() => {
      useFact(AskedAboutTile, (fact) => heard.push(fact))
    })
    publish(new AskedAboutTile({ tile: 'a' }))
    publish(new AskedAboutTile({ tile: 'root', place: 3 }))
    expect(heard).toEqual([
      new AskedAboutTile({ tile: 'a' }),
      new AskedAboutTile({ tile: 'root', place: 3 }),
    ])
  })

  it('refuses a place that is no Direction', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const heard: AskedAboutTile[] = []
    renderHook(() => {
      useFact(AskedAboutTile, (fact) => heard.push(fact))
    })
    receive(AskedAboutTile, { _tag: 'AskedAboutTile', tile: 'root', place: 7 })
    expect(heard).toEqual([])
  })
})
