// @vitest-environment happy-dom
import { act as settled, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { TileNode } from '../view/tiles'
import type { CanvasView, ViewAction } from '../view/view'

import { heartShare } from '../geometry/shape'

import { useCanvasState, type TileHex, type TileLets } from './useCanvasState'

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

/** `a` centered, opened into its first ring, so its Tiles show around it. */
const inA: CanvasView = { center: 'a', frame: 'children' }

/** The root opened, `a` opened in place in its ring. */
const aOpen: CanvasView = { ...open, expanded: { 1: 'children' } }

interface Hand {
  finger?: boolean
  lets?: (hex: TileHex) => TileLets
  fills?: (tile: TileNode) => boolean
}

function render(view: CanvasView, { finger = false, lets, fills }: Hand = {}) {
  const onViewChange = vi.fn<(view: CanvasView, action: ViewAction) => void>()
  const { result } = renderHook(() =>
    useCanvasState({ system, view, onViewChange, finger, lets, fills }),
  )
  return { ...result.current, onViewChange }
}

/** The hex holding a Tile under this key. */
function hexOf(hexes: ReturnType<typeof render>['state']['hexes'], key: string): TileHex {
  const found = hexes.find((hex): hex is TileHex => hex.kind === 'tile' && hex.key === key)
  if (found === undefined) throw new Error(`No Tile is drawn under ${key}`)
  return found
}

/** What a click does on each Tile drawn, by key. */
function actions(view: CanvasView, hand: Hand = {}) {
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

  it('opens nothing holding nothing the reader may add to: such a Branch is centered, and stands alone', () => {
    const nobody = () => false
    expect(actions(open, { fills: nobody })).toMatchObject({
      'tile:a': 'expand',
      'tile:many': 'expand',
    })
    const empty = render(inA, { fills: nobody })
    expect(empty.actions.actionOf(hexOf(empty.state.hexes, 'tile:a3'))).toBe('center')
    const alone = render({ center: 'a3', frame: 'children' }, { fills: nobody })
    expect(alone.state.hexes.filter((hex) => hex.kind === 'empty')).toHaveLength(0)
    expect(alone.actions.actionOf(hexOf(alone.state.hexes, 'tile:a3'))).toBeUndefined()
    const added = render({ center: 'a3', frame: 'children' })
    expect(added.state.hexes.filter((hex) => hex.kind === 'empty')).toHaveLength(6)
  })

  it('does nothing on the untitled root, its lamp alone, not there yet', () => {
    const untitled = { ...system, title: '', root: 'untitled' as const }
    const { result } = renderHook(() =>
      useCanvasState({ system: untitled, view: {}, onViewChange: vi.fn(), finger: false }),
    )
    const { state, actions: act } = result.current
    expect(act.actionOf(hexOf(state.hexes, 'tile:root'))).toBeUndefined()
  })

  it('takes no C on the untitled root, nor on an empty System’s, which nothing answers on', () => {
    for (const root of ['untitled', 'empty'] as const) {
      const onViewChange = vi.fn()
      const { result } = renderHook(() =>
        useCanvasState({ system: { ...system, root }, view: {}, onViewChange, finger: false }),
      )
      result.current.actions.cycle()
      expect(onViewChange).not.toHaveBeenCalled()
    }
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

  it('goes in, centering the Tile as it is drawn, and leaves the center where it is', () => {
    const { state, actions: act, onViewChange } = render(open)
    act.go(hexOf(state.hexes, 'tile:a'), 'go-in')
    expect(onViewChange).toHaveBeenLastCalledWith({ center: 'a' }, { gesture: 'center', tile: 'a' })
    act.go(hexOf(state.hexes, 'tile:root'), 'go-in')
    expect(onViewChange).toHaveBeenCalledOnce()
    const opened = render(aOpen)
    opened.actions.go(hexOf(opened.state.hexes, 'tile:a'), 'go-in')
    expect(opened.onViewChange).toHaveBeenLastCalledWith(inA, { gesture: 'center', tile: 'a' })
  })

  it("shows the center's Context inside it, opening it were it folded, and no other Tile's", () => {
    const { state, actions: act, onViewChange } = render(open)
    act.go(hexOf(state.hexes, 'tile:a'), 'show-context')
    expect(onViewChange).not.toHaveBeenCalled()
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

  it('backs out to the Tile the center stands under, opened, the center as it was, and nowhere from the Root', () => {
    const inside = render(inA)
    inside.actions.go(hexOf(inside.state.hexes, 'tile:a'), 'back-out')
    expect(inside.onViewChange).toHaveBeenLastCalledWith(aOpen, {
      gesture: 'center',
      tile: 'root',
    })
    const top = render({})
    top.actions.go(hexOf(top.state.hexes, 'tile:root'), 'back-out')
    expect(top.onViewChange).not.toHaveBeenCalled()
  })
})

describe('the C key', () => {
  it('cycles the center: alone, opened into its ring, its Context inside too, then alone again', () => {
    const steps: [CanvasView, CanvasView, ViewAction['gesture']][] = [
      [{}, open, 'expand'],
      [open, { ...open, inner: 'context' }, 'show-context'],
      [{ ...open, inner: 'context' }, {}, 'collapse'],
    ]
    for (const [from, to, gesture] of steps) {
      const { actions: act, onViewChange } = render(from)
      act.cycle()
      expect(onViewChange).toHaveBeenLastCalledWith(to, { gesture, tile: 'root' })
    }
  })

  it('keeps a Branch of the ring open as the Context shows inside the center', () => {
    const { actions: act, onViewChange } = render({ ...open, expanded: { 1: 'children' } })
    act.cycle()
    expect(onViewChange).toHaveBeenLastCalledWith(
      { ...open, inner: 'context', expanded: { 1: 'children' } },
      { gesture: 'show-context', tile: 'root' },
    )
  })

  it('skips a Context that shows nothing, folding the center back from its ring', () => {
    const { actions: act, onViewChange } = render(inA, { fills: () => false })
    act.cycle()
    expect(onViewChange).toHaveBeenLastCalledWith(
      { center: 'a' },
      { gesture: 'collapse', tile: 'a' },
    )
  })

  it('does nothing where the center holds its click back', () => {
    const { actions: act, onViewChange } = render(
      {},
      { lets: () => ({ click: false, recenter: true }) },
    )
    act.cycle()
    expect(onViewChange).not.toHaveBeenCalled()
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

  it('centers a Leaf, alone, and a Reference on the Tile it points at, as that one is drawn', () => {
    const { state, actions: act, onViewChange } = render({ ...aOpen, inner: 'context' })
    act.click(hexOf(state.hexes, 'tile:notes'))
    expect(onViewChange).toHaveBeenLastCalledWith(
      { center: 'notes', around: { 1: {} } },
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

describe('what moves as the view changes', () => {
  afterEach(() => {
    vi.useRealTimers()
    document.documentElement.style.removeProperty('--duration-fold')
  })

  it('holds the fold until the view that closes it lands, then forgets it', () => {
    vi.useFakeTimers()
    document.documentElement.style.setProperty('--duration-fold', '500ms')
    const onViewChange = vi.fn<(view: CanvasView, action: ViewAction) => void>()
    const { result, rerender } = renderHook(
      ({ view }: { view: CanvasView }) => useCanvasState({ system, view, onViewChange }),
      { initialProps: { view: aOpen } },
    )
    settled(() => {
      result.current.actions.click(hexOf(result.current.state.hexes, 'tile:a'))
    })
    settled(() => {
      vi.advanceTimersByTime(500)
    })
    // The view it handed on has not landed yet: what folded stays folded meanwhile.
    expect(result.current.actions.motionOf('tile:a3')).toMatchObject({ way: 'fold' })
    rerender({ view: open })
    rerender({ view: aOpen })
    expect(result.current.actions.motionOf('tile:a3')).not.toMatchObject({ way: 'fold' })
  })

  it('blooms nothing where a fold was given up, which plays back to rest', () => {
    vi.useFakeTimers()
    document.documentElement.style.setProperty('--duration-fold', '500ms')
    const onViewChange = vi.fn<(view: CanvasView, action: ViewAction) => void>()
    const { result } = renderHook(() => useCanvasState({ system, view: aOpen, onViewChange }))
    settled(() => {
      result.current.actions.click(hexOf(result.current.state.hexes, 'tile:a'))
    })
    settled(() => {
      result.current.actions.center(hexOf(result.current.state.hexes, 'tile:a'), 'pointer')
    })
    expect(result.current.actions.motionOf('tile:a3')).toBeUndefined()
    expect(result.current.actions.motionOf('tile:notes')).toMatchObject({ way: 'bloom' })
  })

  it('blooms nothing the camera brings as the center changes, then what opens in place', () => {
    const onViewChange = vi.fn<(view: CanvasView, action: ViewAction) => void>()
    const { result, rerender } = renderHook(
      ({ view }: { view: CanvasView }) => useCanvasState({ system, view, onViewChange }),
      { initialProps: { view: inA } },
    )
    // a3 bloomed as a opened, and keeps that bloom, played once; notes and many come with the camera.
    const bloomed = result.current.actions.motionOf('tile:a3')
    rerender({ view: aOpen })
    expect(result.current.actions.motionOf('tile:notes')).toBeUndefined()
    expect(result.current.actions.motionOf('tile:many')).toBeUndefined()
    expect(result.current.actions.motionOf('tile:a3')?.way).toBe(bloomed?.way)
    rerender({ view: { ...aOpen, expanded: { 1: 'children', 4: 'branches' } } })
    expect(result.current.actions.motionOf('tile:m1')).toMatchObject({ way: 'bloom' })
  })

  it('settles a Tile folded going out a level from the heart it was drawn at, and nothing else', () => {
    const onViewChange = vi.fn<(view: CanvasView, action: ViewAction) => void>()
    const { result, rerender } = renderHook(
      ({ view }: { view: CanvasView }) => useCanvasState({ system, view, onViewChange }),
      {
        initialProps: { view: { center: 'many', frame: 'branches', expanded: { 1: 'children' } } },
      },
    )
    rerender({ view: { frame: 'children', expanded: { 4: 'branches' } } })
    expect(result.current.actions.grownOf('tile:m1')).toBeCloseTo(heartShare)
    expect(result.current.actions.grownOf('tile:many')).toBeUndefined()
    expect(result.current.actions.grownOf('tile:m2')).toBeUndefined()
  })
})

describe('centering', () => {
  it('centers from the keyboard at once, the Tile as it is drawn, folded or opened', () => {
    const { state, actions: act, onViewChange } = render(open)
    act.center(hexOf(state.hexes, 'tile:a'), 'keyboard')
    expect(onViewChange).toHaveBeenLastCalledWith({ center: 'a' }, { gesture: 'center', tile: 'a' })
    const opened = render(aOpen)
    opened.actions.center(hexOf(opened.state.hexes, 'tile:a'), 'keyboard')
    expect(opened.onViewChange).toHaveBeenLastCalledWith(inA, { gesture: 'center', tile: 'a' })
  })

  it('centers on a double-click only where its first click landed', () => {
    const { state, actions: act, onViewChange } = render(aOpen)
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

describe('the Tiles around the center', () => {
  const keys = (view: CanvasView, hand: Hand = {}) =>
    render(view, hand).state.around.map(({ key }) => key)

  it('draws the Tile it stands in and the rest of that ring, none around the Root', () => {
    expect(keys(inA)).toEqual(['above:root', 'beside:tile:notes', 'beside:tile:many'])
    expect(keys({ center: 'a' })).toEqual(keys(inA))
    expect(keys(open)).toEqual([])
  })

  it('centers each by a click or by going in, each Tile keeping its state', () => {
    const { state, actions: act, onViewChange } = render(inA)
    const [root, notes] = state.around
    if (root?.kind !== 'tile' || notes?.kind !== 'tile')
      throw new Error('Nothing is drawn around a')
    act.around(root)
    expect(onViewChange).toHaveBeenLastCalledWith(aOpen, { gesture: 'center', tile: 'root' })
    act.around(notes)
    expect(onViewChange).toHaveBeenLastCalledWith(
      { center: 'notes', around: { 1: {} } },
      { gesture: 'center', tile: 'notes' },
    )
  })

  it('draws a Tile beside the center opened as the view says, with what it opens into', () => {
    const opened = render({ ...inA, around: { 4: { 1: 'children' } } }).state.around
    expect(opened.map(({ key }) => key)).toEqual(
      expect.arrayContaining(['beside:ground:many', 'beside:tile:many', 'beside:tile:m1']),
    )
    expect(opened.find(({ key }) => key === 'beside:tile:many')).toMatchObject({ role: 'hub' })
  })

  it('draws none where its caller holds moving the center back', () => {
    expect(keys(inA, { lets: () => ({ click: true, recenter: false }) })).toEqual([])
  })
})

describe('what its caller holds back', () => {
  const nothing = () => ({ click: false, recenter: false })

  it('leaves every Tile without a click, the center included, so none is a button', () => {
    const { state, actions: act } = render(open, { lets: nothing })
    const clicks = state.hexes.flatMap((hex) => (hex.kind === 'tile' ? [act.actionOf(hex)] : []))
    expect(clicks).not.toHaveLength(0)
    expect(clicks.every((action) => action === undefined)).toBe(true)
  })

  it('opens nothing and goes in nowhere, by a click, a double click, Shift+Enter or a menu', () => {
    const { state, actions: act, onViewChange } = render({}, { lets: nothing })
    const center = hexOf(state.hexes, 'tile:root')
    act.click(center)
    act.go(center, 'open')
    expect(onViewChange).not.toHaveBeenCalled()
    const opened = render(open, { lets: nothing })
    const a = hexOf(opened.state.hexes, 'tile:a')
    opened.actions.click(a)
    opened.actions.center(a, 'pointer')
    opened.actions.center(a, 'keyboard')
    opened.actions.go(a, 'go-in')
    opened.actions.go(a, 'show-context')
    expect(opened.onViewChange).not.toHaveBeenCalled()
  })

  it('moves the center nowhere where that is held, by a click, a menu or Back out', () => {
    const clicks = () => ({ click: true, recenter: false })
    const { state, actions: act, onViewChange } = render(open, { lets: clicks })
    const notes = hexOf(state.hexes, 'tile:notes')
    expect(act.actionOf(notes)).toBeUndefined()
    act.click(notes)
    act.go(notes, 'show-context')
    expect(onViewChange).not.toHaveBeenCalled()
    const inside = render(inA, { lets: clicks })
    const a = hexOf(inside.state.hexes, 'tile:a')
    inside.actions.go(a, 'back-out')
    expect(inside.onViewChange).not.toHaveBeenCalled()
    inside.actions.click(a)
    expect(inside.onViewChange).toHaveBeenCalledExactlyOnceWith(
      { center: 'a' },
      { gesture: 'collapse', tile: 'a' },
    )
  })

  it('lets through what it lets through, Tile by Tile: the center opening, nothing going in', () => {
    const lets = (hex: TileHex) => ({ click: hex.role === 'center', recenter: false })
    expect(actions({})).toEqual({ 'tile:root': 'expand' })
    const { state, actions: act, onViewChange } = render(open, { lets })
    expect(act.actionOf(hexOf(state.hexes, 'tile:root'))).toBe('collapse')
    expect(act.actionOf(hexOf(state.hexes, 'tile:a'))).toBeUndefined()
    act.center(hexOf(state.hexes, 'tile:a'), 'keyboard')
    expect(onViewChange).not.toHaveBeenCalled()
  })
})
