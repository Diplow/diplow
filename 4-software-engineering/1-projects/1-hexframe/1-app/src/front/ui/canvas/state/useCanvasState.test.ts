// @vitest-environment happy-dom
import { act as settled, cleanup, renderHook } from '@testing-library/react'
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
  context: { 1: tile('why'), 2: tile('a', { reference: { from: 'Elsewhere' } }) },
})

/** The root opened into its first ring, as a click on it leaves it. */
const open: CanvasView = { frame: 'children' }

/** `a` centered, as a gesture leaves it: opened into its first ring, so its Tiles show around it. */
const inA: CanvasView = { center: 'a', frame: 'children' }

function render(view: CanvasView, { finger = false } = {}) {
  const onViewChange = vi.fn<(view: CanvasView, action: ViewAction) => void>()
  const { result } = renderHook(() => useCanvasState({ system, view, onViewChange, finger }))
  return { ...result.current, onViewChange }
}

/** The hex holding a Tile under this key. */
function hexOf(hexes: ReturnType<typeof render>['state']['hexes'], key: string): TileHex {
  const found = hexes.find((hex): hex is TileHex => hex.kind === 'tile' && hex.key === key)
  if (found === undefined) throw new Error(`No Tile is drawn under ${key}`)
  return found
}

/** What a click does on each Tile drawn, by key. */
function actions(view: CanvasView, hand = { finger: false }) {
  const { state, actions: act } = render(view, hand)
  return Object.fromEntries(
    state.hexes.flatMap((hex) => (hex.kind === 'tile' ? [[hex.key, act.actionOf(hex)]] : [])),
  )
}

describe('what a click on a Tile does', () => {
  it('opens the folded center, which stands alone', () => {
    expect(actions({})).toEqual({ 'tile:root': 'expand' })
  })

  it('folds the open center, opens a Branch, and centers a Leaf', () => {
    expect(actions(open)).toEqual({
      'tile:root': 'collapse',
      'tile:a': 'expand',
      'tile:notes': 'center',
      'tile:many': 'expand',
    })
  })

  it('closes an open Branch from its own Tile, and centers what it holds, a generation further', () => {
    expect(actions({ ...open, expanded: { 1: 'children' } })).toMatchObject({
      'tile:a': 'collapse',
      'tile:a3': 'center',
    })
  })

  it('folds the center from its heart when a ring shows inside it, and centers a Context Tile', () => {
    expect(actions({ ...open, inner: 'context' })).toMatchObject({
      'tile:root': 'collapse',
      'tile:root:context:1': 'center',
      'tile:root:context:2': 'center',
    })
    expect(actions({ center: 'many', frame: 'branches', inner: 'leaves' })).toMatchObject({
      'tile:many': 'collapse',
      'tile:ml1': 'center',
    })
  })

  it('does nothing on a centered Leaf, which opens nothing', () => {
    expect(actions({ center: 'notes' })).toEqual({ 'tile:notes': undefined })
  })

  it('does nothing on the untitled root, its lamp alone, not there yet', () => {
    const untitled = { ...system, title: '', root: 'untitled' as const }
    const { result } = renderHook(() =>
      useCanvasState({ system: untitled, view: {}, onViewChange: vi.fn(), finger: false }),
    )
    const { state, actions: act } = result.current
    expect(act.actionOf(hexOf(state.hexes, 'tile:root'))).toBeUndefined()
  })

  it('goes into a Branch of the ring under a finger, which has no double click, and does the rest alike', () => {
    expect(actions({}, { finger: true })).toEqual({ 'tile:root': 'expand' })
    expect(actions(open, { finger: true })).toEqual({
      'tile:root': 'collapse',
      'tile:a': 'center',
      'tile:notes': 'center',
      'tile:many': 'center',
    })
    expect(actions({ ...open, expanded: { 1: 'children' } }, { finger: true })).toMatchObject({
      'tile:a': 'collapse',
    })
  })
})

describe("a line of a tile's menu that goes somewhere", () => {
  it('opens a Branch of the ring in place, a finger or not, as a click does', () => {
    for (const finger of [false, true]) {
      const { state, actions: act, onViewChange } = render(open, { finger })
      act.go(hexOf(state.hexes, 'tile:a'), 'open')
      expect(onViewChange).toHaveBeenLastCalledWith(
        { ...open, expanded: { 1: 'children' } },
        { gesture: 'expand', tile: 'a' },
      )
    }
  })

  it('opens the folded center, as a click does', () => {
    const { state, actions: act, onViewChange } = render({})
    act.go(hexOf(state.hexes, 'tile:root'), 'open')
    expect(onViewChange).toHaveBeenLastCalledWith(open, { gesture: 'expand', tile: 'root' })
  })

  it('goes in, centering the Tile opened, and leaves the center where it is', () => {
    const { state, actions: act, onViewChange } = render(open)
    act.go(hexOf(state.hexes, 'tile:a'), 'go-in')
    expect(onViewChange).toHaveBeenLastCalledWith(inA, { gesture: 'center', tile: 'a' })
    act.go(hexOf(state.hexes, 'tile:root'), 'go-in')
    expect(onViewChange).toHaveBeenCalledOnce()
  })

  it("shows a Tile's Context by centering it, and the center's inside it, opening it were it folded", () => {
    const { state, actions: act, onViewChange } = render(open)
    act.go(hexOf(state.hexes, 'tile:a'), 'show-context')
    expect(onViewChange).toHaveBeenLastCalledWith(
      { center: 'a', frame: 'children', inner: 'context' },
      { gesture: 'show-context', tile: 'a' },
    )
    act.go(hexOf(state.hexes, 'tile:root'), 'show-context')
    expect(onViewChange).toHaveBeenLastCalledWith(
      { ...open, inner: 'context' },
      { gesture: 'show-context', tile: 'root' },
    )
    const folded = render({})
    folded.actions.go(hexOf(folded.state.hexes, 'tile:root'), 'show-context')
    expect(folded.onViewChange).toHaveBeenLastCalledWith(
      { ...open, inner: 'context' },
      { gesture: 'show-context', tile: 'root' },
    )
  })

  it('leaves the Context shown inside the center as it is', () => {
    const { state, actions: act, onViewChange } = render({ ...open, inner: 'context' })
    act.go(hexOf(state.hexes, 'tile:root'), 'show-context')
    expect(onViewChange).not.toHaveBeenCalled()
  })

  it('backs out to the Tile the center stands under, opened, and nowhere from the Root', () => {
    const inside = render(inA)
    inside.actions.go(hexOf(inside.state.hexes, 'tile:a'), 'back-out')
    expect(inside.onViewChange).toHaveBeenLastCalledWith(open, { gesture: 'center', tile: 'root' })
    const top = render({})
    top.actions.go(hexOf(top.state.hexes, 'tile:root'), 'back-out')
    expect(top.onViewChange).not.toHaveBeenCalled()
  })
})

describe('a click', () => {
  it('opens the center into its first ring, then folds it back alone, what was inside included', () => {
    const folded = render({})
    folded.actions.click(hexOf(folded.state.hexes, 'tile:root'))
    expect(folded.onViewChange).toHaveBeenLastCalledWith(open, {
      gesture: 'expand',
      tile: 'root',
    })
    const shown = render({ ...open, inner: 'context' })
    shown.actions.click(hexOf(shown.state.hexes, 'tile:root'))
    expect(shown.onViewChange).toHaveBeenLastCalledWith({}, { gesture: 'collapse', tile: 'root' })
  })

  it('opens a center of more than six into its Branches, its Leaves inside it', () => {
    const { state, actions: act, onViewChange } = render({ center: 'many' })
    act.click(hexOf(state.hexes, 'tile:many'))
    expect(onViewChange).toHaveBeenLastCalledWith(
      { center: 'many', frame: 'branches', inner: 'leaves' },
      { gesture: 'expand', tile: 'many' },
    )
  })

  it('opens a Branch, then closes it', () => {
    const closed = render(open)
    closed.actions.click(hexOf(closed.state.hexes, 'tile:a'))
    expect(closed.onViewChange).toHaveBeenLastCalledWith(
      { ...open, expanded: { 1: 'children' } },
      { gesture: 'expand', tile: 'a' },
    )
    const opened = render({ ...open, expanded: { 1: 'children' } })
    opened.actions.click(hexOf(opened.state.hexes, 'tile:a'))
    expect(opened.onViewChange).toHaveBeenLastCalledWith(open, { gesture: 'collapse', tile: 'a' })
  })

  it('centers a Leaf, alone, and a Reference on the Tile it points at, opened', () => {
    const { state, actions: act, onViewChange } = render({ ...open, inner: 'context' })
    act.click(hexOf(state.hexes, 'tile:notes'))
    expect(onViewChange).toHaveBeenLastCalledWith(
      { center: 'notes' },
      { gesture: 'center', tile: 'notes' },
    )
    act.click(hexOf(state.hexes, 'tile:root:context:2'))
    expect(onViewChange).toHaveBeenLastCalledWith(inA, { gesture: 'center', tile: 'a' })
  })

  it('does nothing on a centered Leaf', () => {
    const centered = render({ center: 'notes' })
    centered.actions.click(hexOf(centered.state.hexes, 'tile:notes'))
    expect(centered.onViewChange).not.toHaveBeenCalled()
  })
})

describe('what an opened hex holds', () => {
  afterEach(() => {
    vi.useRealTimers()
    document.documentElement.style.removeProperty('--duration-fold')
  })

  it('blooms out of its heart, each after its elder siblings; the center stays still', () => {
    const { state, actions } = render({ ...open, expanded: { 1: 'children' } })
    const heart = hexOf(state.hexes, 'tile:a').hex.center
    expect(actions.motionOf('tile:a3')).toEqual({ way: 'bloom', from: heart, order: 2 })
    expect(actions.motionOf('tile:root')).toBeUndefined()
  })

  it("blooms the center's ring out of the center's heart, each after its elder siblings", () => {
    const { state, actions } = render(open)
    const heart = hexOf(state.hexes, 'tile:root').hex.center
    expect(actions.motionOf('tile:a')).toEqual({ way: 'bloom', from: heart, order: 0 })
    expect(actions.motionOf('tile:notes')).toEqual({ way: 'bloom', from: heart, order: 1 })
  })

  it("blooms out of the center's heart when the center shows its Context", () => {
    const { state, actions } = render({ ...open, inner: 'context' })
    const heart = hexOf(state.hexes, 'tile:root').hex.center
    expect(actions.motionOf('tile:root:context:1')).toMatchObject({ way: 'bloom', from: heart })
  })

  it('folds back into its heart for --duration-fold, then closes, taking no click meanwhile', () => {
    vi.useFakeTimers()
    document.documentElement.style.setProperty('--duration-fold', '500ms')
    const onViewChange = vi.fn<(view: CanvasView, action: ViewAction) => void>()
    const { result } = renderHook(() =>
      useCanvasState({ system, view: { ...open, expanded: { 1: 'children' } }, onViewChange }),
    )
    settled(() => {
      result.current.actions.click(hexOf(result.current.state.hexes, 'tile:a'))
    })
    expect(result.current.actions.motionOf('tile:a3')).toMatchObject({ way: 'fold' })
    expect(result.current.actions.motionOf('tile:notes')).toMatchObject({ way: 'bloom' })
    result.current.actions.click(hexOf(result.current.state.hexes, 'tile:notes'))
    expect(onViewChange).not.toHaveBeenCalled()
    settled(() => {
      vi.advanceTimersByTime(500)
    })
    expect(onViewChange).toHaveBeenCalledExactlyOnceWith(open, { gesture: 'collapse', tile: 'a' })
  })

  it('folds the whole ring back into the center as it folds, then leaves it alone', () => {
    vi.useFakeTimers()
    document.documentElement.style.setProperty('--duration-fold', '500ms')
    const onViewChange = vi.fn<(view: CanvasView, action: ViewAction) => void>()
    const { result } = renderHook(() =>
      useCanvasState({ system, view: { ...open, expanded: { 1: 'children' } }, onViewChange }),
    )
    settled(() => {
      result.current.actions.click(hexOf(result.current.state.hexes, 'tile:root'))
    })
    for (const key of ['tile:a', 'tile:a3', 'tile:notes']) {
      expect(result.current.actions.motionOf(key)).toMatchObject({ way: 'fold' })
    }
    settled(() => {
      vi.advanceTimersByTime(500)
    })
    expect(onViewChange).toHaveBeenCalledExactlyOnceWith({}, { gesture: 'collapse', tile: 'root' })
  })

  it('gives a fold up for a view changed meanwhile, rather than overwriting it', () => {
    vi.useFakeTimers()
    document.documentElement.style.setProperty('--duration-fold', '500ms')
    const onViewChange = vi.fn<(view: CanvasView, action: ViewAction) => void>()
    const { result, rerender } = renderHook(
      ({ view }: { view: CanvasView }) => useCanvasState({ system, view, onViewChange }),
      { initialProps: { view: { ...open, expanded: { 1: 'children' } } } },
    )
    settled(() => {
      result.current.actions.click(hexOf(result.current.state.hexes, 'tile:a'))
    })
    rerender({ view: { ...open, expanded: { 1: 'children' }, inner: 'context' } })
    settled(() => {
      vi.advanceTimersByTime(500)
    })
    expect(onViewChange).not.toHaveBeenCalled()
  })

  it('hands its view to the latest onViewChange, which knows what else the page changed meanwhile', () => {
    vi.useFakeTimers()
    document.documentElement.style.setProperty('--duration-fold', '500ms')
    const before = vi.fn<(view: CanvasView, action: ViewAction) => void>()
    const after = vi.fn<(view: CanvasView, action: ViewAction) => void>()
    const view: CanvasView = { ...open, expanded: { 1: 'children' } }
    const { result, rerender } = renderHook(
      ({ onViewChange }) => useCanvasState({ system, view, onViewChange }),
      { initialProps: { onViewChange: before } },
    )
    settled(() => {
      result.current.actions.click(hexOf(result.current.state.hexes, 'tile:a'))
    })
    rerender({ onViewChange: after })
    settled(() => {
      vi.advanceTimersByTime(500)
    })
    expect(before).not.toHaveBeenCalled()
    expect(after).toHaveBeenCalledExactlyOnceWith(open, { gesture: 'collapse', tile: 'a' })
  })

  it('gives a fold up for a Tile centered meanwhile', () => {
    vi.useFakeTimers()
    document.documentElement.style.setProperty('--duration-fold', '500ms')
    const onViewChange = vi.fn<(view: CanvasView, action: ViewAction) => void>()
    const { result } = renderHook(() =>
      useCanvasState({ system, view: { ...open, expanded: { 1: 'children' } }, onViewChange }),
    )
    settled(() => {
      result.current.actions.click(hexOf(result.current.state.hexes, 'tile:a'))
    })
    settled(() => {
      result.current.actions.center(hexOf(result.current.state.hexes, 'tile:a'), 'pointer')
    })
    settled(() => {
      vi.advanceTimersByTime(500)
    })
    expect(onViewChange).toHaveBeenCalledExactlyOnceWith(inA, { gesture: 'center', tile: 'a' })
  })
})

describe('centering', () => {
  it('centers from the keyboard at once, the Tile opened as it arrives', () => {
    const { state, actions: act, onViewChange } = render(open)
    act.center(hexOf(state.hexes, 'tile:a'), 'keyboard')
    expect(onViewChange).toHaveBeenLastCalledWith(inA, { gesture: 'center', tile: 'a' })
  })

  it('centers on a double-click only where its first click landed', () => {
    const { state, actions: act, onViewChange } = render(open)
    act.center(hexOf(state.hexes, 'tile:a'), 'pointer')
    expect(onViewChange).not.toHaveBeenCalled()
    act.click(hexOf(state.hexes, 'tile:a'))
    act.center(hexOf(state.hexes, 'tile:a'), 'pointer')
    expect(onViewChange).toHaveBeenLastCalledWith(inA, { gesture: 'center', tile: 'a' })
  })

  it('leaves the center where it is', () => {
    const { state, actions: act, onViewChange } = render(open)
    act.center(hexOf(state.hexes, 'tile:root'), 'keyboard')
    expect(onViewChange).not.toHaveBeenCalled()
  })
})
