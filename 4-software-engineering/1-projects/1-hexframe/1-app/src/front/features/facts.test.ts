// @vitest-environment happy-dom
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useCanvasState, type TileHex } from '#/front/ui/hex/state/useCanvasState'
import type { TileNode } from '#/front/ui/hex/view/tiles'

import { publish, receive, useFact } from './bus'
import { Navigated } from './facts'

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
        view: {},
        onViewChange: (_next, action) => {
          publish(new Navigated(action))
        },
      }),
    )
    const { state, actions } = result.current
    const a = state.hexes.find((hex): hex is TileHex => hex.kind === 'tile' && hex.key === 'tile:a')
    if (a === undefined) throw new Error('No Tile a is drawn')
    actions.click(a, false)
    actions.showInside('context')
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
