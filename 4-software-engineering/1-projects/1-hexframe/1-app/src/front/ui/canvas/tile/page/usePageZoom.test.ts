// @vitest-environment happy-dom
import { act as settled, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { layoutCanvas } from '../../geometry/shape'
import type { TileNode } from '../../view/tiles'
import { showView, type CanvasView } from '../../view/view'

import { framedIn, usePageZoom } from './usePageZoom'

// The page's zoom off a browser's animations: where the center is framed, how the drawing beneath
// the page fades, and the page leaving at once where nothing plays.

afterEach(cleanup)

const tile = (id: string, more: Partial<TileNode> = {}): TileNode => ({
  id,
  title: id,
  preview: '',
  ...more,
})

const system = tile('root', { branches: { 1: tile('a'), 4: tile('b') } })

const hexesOf = (view: CanvasView) => layoutCanvas(showView(system, view))

describe('framedIn', () => {
  it('frames a center showing its Context by the hex it opens into, any other by its own', () => {
    const opened = hexesOf({ frame: 'children', inner: 'context' })
    const ground = opened.find((hex) => hex.key === 'ground:root')?.hex
    expect(ground).toBeDefined()
    expect(framedIn(opened, 'root')).toBe(ground)
    const ring = hexesOf({ frame: 'children' })
    expect(framedIn(ring, 'root')).toBe(ring.find((hex) => hex.key === 'tile:root')?.hex)
    const alone = hexesOf({})
    expect(framedIn(alone, 'root')).toBe(alone.find((hex) => hex.key === 'tile:root')?.hex)
  })
})

describe('usePageZoom', () => {
  const svg = { current: null }
  const framed = { center: { x: 0, y: 0 }, radius: 1 }

  it('keeps the drawing out of reach and faded while the page shows, and in hand otherwise', () => {
    const { result, rerender } = renderHook(({ open }) => usePageZoom({ open, svg, framed }), {
      initialProps: { open: false },
    })
    expect(result.current.fades).toEqual({ under: false, now: false })
    rerender({ open: true })
    expect(result.current.fades).toEqual({ under: true, now: true })
  })

  it('leaves at once where nothing plays, the drawing still faded until the view leaves it', () => {
    const { result } = renderHook(() => usePageZoom({ open: true, svg, framed }))
    const then = vi.fn(() => true)
    settled(() => {
      result.current.leave(then)
    })
    expect(then).toHaveBeenCalledOnce()
    expect(result.current.fades).toEqual({ under: true, now: true })
  })
})
