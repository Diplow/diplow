// @vitest-environment happy-dom
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useCanvasState, type TileHex } from '#/front/ui/hex/state/useCanvasState'
import type { TileNode } from '#/front/ui/hex/view/tiles'
import type { CanvasView } from '#/front/ui/hex/view/view'

import { publish, receive, useFact } from './bus'
import { Navigated } from './facts'

// The navigation fact as home publishes it: every gesture on the canvas hands the route the next
// view and the gesture, and the route publishes a `Navigated` for it, which a feature hears through
// `useFact`. A System made by hand, with a center past six Children so both rings can be picked.

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

const many = tile('many', {
  branches: { 1: tile('m1'), 2: tile('m2'), 3: tile('m3'), 4: tile('m4') },
  leaves: {
    1: tile('ml1', { leaf: true }),
    2: tile('ml2', { leaf: true }),
    3: tile('ml3', { leaf: true }),
  },
  context: { 1: tile('why') },
})

const system = tile('root', { branches: { 1: tile('a'), 4: many } })

/** A feature listening on the bus, and the navigation facts it heard. */
function listening() {
  const heard: Navigated[] = []
  renderHook(() => {
    useFact(Navigated, (fact) => heard.push(fact))
  })
  return heard
}

/** The canvas on `view`, each gesture's view change published as home publishes it. */
function canvas(view: CanvasView) {
  const { result } = renderHook(() =>
    useCanvasState({
      system,
      view,
      onViewChange: (_next, action) => {
        publish(new Navigated(action))
      },
    }),
  )
  const { state, actions } = result.current
  const hex = (key: string) => {
    const found = state.hexes.find((h): h is TileHex => h.kind === 'tile' && h.key === key)
    if (found === undefined) throw new Error(`No Tile is drawn under ${key}`)
    return found
  }
  return { actions, hex }
}

describe('the navigation fact', () => {
  it('is heard once per gesture, named as the canvas names it, with its Tile', () => {
    const heard = listening()
    const root = canvas({})
    root.actions.click(root.hex('tile:a'), false)
    root.actions.click(root.hex('tile:root'), false)
    root.actions.center(root.hex('tile:many'), 'keyboard')
    const centered = canvas({ center: 'many', inner: 'context', expanded: { 1: 'children' } })
    centered.actions.click(centered.hex('tile:m1'), false)
    centered.actions.click(centered.hex('tile:many'), false)
    centered.actions.showInside('leaves')
    centered.actions.showAround('leaves')
    const leaves = canvas({ center: 'many', inner: 'leaves' })
    leaves.actions.click(leaves.hex('tile:many'), false)
    const around = canvas({ center: 'many', frame: 'leaves' })
    around.actions.showAround('branches')
    expect(heard.map(({ gesture, tile }) => [gesture, tile])).toEqual([
      ['expand', 'a'],
      ['show-context', 'root'],
      ['center', 'many'],
      ['collapse', 'm1'],
      ['hide-context', 'many'],
      ['show-leaves', 'many'],
      ['show-leaves-around', 'many'],
      ['hide-leaves', 'many'],
      ['show-branches-around', 'many'],
    ])
  })

  it('is not heard when nothing changed', () => {
    const heard = listening()
    const root = canvas({})
    root.actions.click(root.hex('tile:a'), true)
    root.actions.showInside(undefined)
    expect(heard).toEqual([])
  })

  it('crosses into the client by its schema, a gesture the canvas does not name refused', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const heard = listening()
    receive(Navigated, { _tag: 'Navigated', gesture: 'center', tile: 'a' })
    receive(Navigated, { _tag: 'Navigated', gesture: 'zoomed', tile: 'a' })
    expect(heard).toEqual([new Navigated({ gesture: 'center', tile: 'a' })])
  })
})
