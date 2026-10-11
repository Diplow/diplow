// @vitest-environment happy-dom
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { TileNode } from '../view/tiles'
import type { CanvasView, ViewAction } from '../view/view'

import { useCanvasState, type TileHex } from './useCanvasState'

// The canvas's state over a System made by hand: what each Tile's click does, and the next view each
// gesture hands the route, with the gesture's name and its Tile. The view stays the caller's:
// `onViewChange` records what it is handed.

afterEach(cleanup)

const tile = (id: string, more: Partial<TileNode> = {}): TileNode => ({
  id,
  title: id,
  preview: '',
  ...more,
})

const leaf = (id: string) => tile(id, { leaf: true })

const many = tile('many', {
  branches: { 1: tile('m1'), 2: tile('m2'), 3: tile('m3'), 4: tile('m4') },
  leaves: { 1: leaf('ml1'), 2: leaf('ml2'), 3: leaf('ml3') },
})

const system = tile('root', {
  branches: { 1: tile('a', { branches: { 3: tile('a3') } }), 4: many },
  leaves: { 2: leaf('notes') },
  context: { 1: tile('why'), 2: tile('a', { reference: true }) },
})

function render(view: CanvasView) {
  const onViewChange = vi.fn<(view: CanvasView, action: ViewAction) => void>()
  const { result } = renderHook(() => useCanvasState({ system, view, onViewChange }))
  return { ...result.current, onViewChange }
}

/** The hex holding a Tile under this key. */
function hexOf(hexes: ReturnType<typeof render>['state']['hexes'], key: string): TileHex {
  const found = hexes.find((hex): hex is TileHex => hex.kind === 'tile' && hex.key === key)
  if (found === undefined) throw new Error(`No Tile is drawn under ${key}`)
  return found
}

/** What a click does on each Tile drawn, by key. */
function actions(view: CanvasView) {
  const { state, actions: act } = render(view)
  return Object.fromEntries(
    state.hexes.flatMap((hex) => (hex.kind === 'tile' ? [[hex.key, act.actionOf(hex)]] : [])),
  )
}

describe('what a click on a Tile does', () => {
  it('shows the Context from the center, opens a Branch, and centers a Leaf', () => {
    expect(actions({})).toEqual({
      'tile:root': 'show-context',
      'tile:a': 'expand',
      'tile:notes': 'center',
      'tile:many': 'expand',
    })
  })

  it('closes an open Branch from its own Tile, and centers what it holds, a generation further', () => {
    expect(actions({ expanded: { 1: 'children' } })).toMatchObject({
      'tile:a': 'collapse',
      'tile:a3': 'center',
    })
  })

  it('hides the ring inside the center from the center, and centers a Context Tile', () => {
    expect(actions({ inner: 'context' })).toMatchObject({
      'tile:root': 'hide-context',
      'tile:root:context:1': 'center',
      'tile:root:context:2': 'center',
    })
    expect(actions({ center: 'many', inner: 'leaves' })).toMatchObject({
      'tile:many': 'hide-leaves',
      'tile:ml1': 'center',
    })
  })

  it('does nothing on a centered Leaf, which opens nothing', () => {
    expect(actions({ center: 'notes' })).toEqual({ 'tile:notes': undefined })
  })
})

describe('a click', () => {
  it('opens a Branch, then closes it', () => {
    const closed = render({})
    closed.actions.click(hexOf(closed.state.hexes, 'tile:a'), false)
    expect(closed.onViewChange).toHaveBeenLastCalledWith(
      { expanded: { 1: 'children' } },
      { gesture: 'expand', tile: 'a' },
    )
    const open = render({ expanded: { 1: 'children' } })
    open.actions.click(hexOf(open.state.hexes, 'tile:a'), false)
    expect(open.onViewChange).toHaveBeenLastCalledWith({}, { gesture: 'collapse', tile: 'a' })
  })

  it('shows the Context inside the center, then hides it', () => {
    const plain = render({})
    plain.actions.click(hexOf(plain.state.hexes, 'tile:root'), false)
    expect(plain.onViewChange).toHaveBeenLastCalledWith(
      { inner: 'context' },
      { gesture: 'show-context', tile: 'root' },
    )
    const shown = render({ inner: 'context' })
    shown.actions.click(hexOf(shown.state.hexes, 'tile:root'), false)
    expect(shown.onViewChange).toHaveBeenLastCalledWith(
      {},
      { gesture: 'hide-context', tile: 'root' },
    )
  })

  it('hides the Leaves inside the center', () => {
    const { state, actions: act, onViewChange } = render({ center: 'many', inner: 'leaves' })
    act.click(hexOf(state.hexes, 'tile:many'), false)
    expect(onViewChange).toHaveBeenLastCalledWith(
      { center: 'many' },
      { gesture: 'hide-leaves', tile: 'many' },
    )
  })

  it('centers a Leaf, and a Reference on the Tile it points at', () => {
    const { state, actions: act, onViewChange } = render({ inner: 'context' })
    act.click(hexOf(state.hexes, 'tile:notes'), false)
    expect(onViewChange).toHaveBeenLastCalledWith(
      { center: 'notes' },
      { gesture: 'center', tile: 'notes' },
    )
    act.click(hexOf(state.hexes, 'tile:root:context:2'), false)
    expect(onViewChange).toHaveBeenLastCalledWith({ center: 'a' }, { gesture: 'center', tile: 'a' })
  })

  it('does nothing as the second click of a double-click, nor on a centered Leaf', () => {
    const { state, actions: act, onViewChange } = render({})
    act.click(hexOf(state.hexes, 'tile:a'), true)
    const centered = render({ center: 'notes' })
    centered.actions.click(hexOf(centered.state.hexes, 'tile:notes'), false)
    expect(onViewChange).not.toHaveBeenCalled()
    expect(centered.onViewChange).not.toHaveBeenCalled()
  })
})

describe('centering', () => {
  it('centers from the keyboard at once', () => {
    const { state, actions: act, onViewChange } = render({})
    act.center(hexOf(state.hexes, 'tile:a'), 'keyboard')
    expect(onViewChange).toHaveBeenLastCalledWith({ center: 'a' }, { gesture: 'center', tile: 'a' })
  })

  it('centers on a double-click only where its first click landed', () => {
    const { state, actions: act, onViewChange } = render({})
    act.center(hexOf(state.hexes, 'tile:a'), 'pointer')
    expect(onViewChange).not.toHaveBeenCalled()
    act.click(hexOf(state.hexes, 'tile:a'), false)
    act.center(hexOf(state.hexes, 'tile:a'), 'pointer')
    expect(onViewChange).toHaveBeenLastCalledWith({ center: 'a' }, { gesture: 'center', tile: 'a' })
  })

  it('leaves the center where it is', () => {
    const { state, actions: act, onViewChange } = render({})
    act.center(hexOf(state.hexes, 'tile:root'), 'keyboard')
    expect(onViewChange).not.toHaveBeenCalled()
  })
})

describe('the rings the center shows', () => {
  it('are offered as the center offers them', () => {
    expect(render({}).state.rings).toEqual({
      around: 'children',
      inside: undefined,
      choices: { around: ['children'], inside: ['context'] },
    })
    expect(render({ center: 'many', inner: 'leaves' }).state.rings).toEqual({
      around: 'branches',
      inside: 'leaves',
      choices: { around: ['branches', 'leaves'], inside: ['leaves', 'context'] },
    })
  })

  it('change around the center, and inside it', () => {
    const { actions: act, onViewChange } = render({ center: 'many', inner: 'context' })
    act.showAround('leaves')
    expect(onViewChange).toHaveBeenLastCalledWith(
      { center: 'many', frame: 'leaves', inner: 'context' },
      { gesture: 'show-leaves-around', tile: 'many' },
    )
    act.showInside('leaves')
    expect(onViewChange).toHaveBeenLastCalledWith(
      { center: 'many', inner: 'leaves' },
      { gesture: 'show-leaves', tile: 'many' },
    )
    act.showInside(undefined)
    expect(onViewChange).toHaveBeenLastCalledWith(
      { center: 'many' },
      { gesture: 'hide-context', tile: 'many' },
    )
  })

  it('name the ring picked around the center, and the one shown inside it', () => {
    const { actions: act, onViewChange } = render({ center: 'many', frame: 'leaves' })
    act.showAround('branches')
    expect(onViewChange).toHaveBeenLastCalledWith(
      { center: 'many' },
      { gesture: 'show-branches-around', tile: 'many' },
    )
    act.showInside('context')
    expect(onViewChange).toHaveBeenLastCalledWith(
      { center: 'many', frame: 'leaves', inner: 'context' },
      { gesture: 'show-context', tile: 'many' },
    )
  })

  it('stay as they are when the ring shown is picked again', () => {
    const { actions: act, onViewChange } = render({ center: 'many', inner: 'leaves' })
    act.showAround('branches')
    act.showInside('leaves')
    const bare = render({})
    bare.actions.showInside(undefined)
    expect(onViewChange).not.toHaveBeenCalled()
    expect(bare.onViewChange).not.toHaveBeenCalled()
  })
})
