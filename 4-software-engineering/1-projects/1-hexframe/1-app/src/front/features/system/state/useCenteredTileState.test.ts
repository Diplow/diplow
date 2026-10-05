// @vitest-environment happy-dom
import { QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as Mapping from '#/api/mapping/mapping'
import { makeQueryClient } from '#/front/client/channels'
import type { SystemTile } from '#/domains/mapping/entities'
import { m } from '#/paraglide/messages'
import { toast } from '#/front/ui/feedback/Toaster'

import { useCenteredTileState } from './useCenteredTileState'

// What the centered Tile's card offers as a Child of its kind, over a stand-in for the move's server
// function: which Tile grows, which shrinks, which neither, what each sends, and a refusal carried to
// its toast. A refusal is what the client receives, its wire form, decoded.
vi.mock('#/api/mapping/mapping', () => ({ moveTile: vi.fn(), system: vi.fn() }))
vi.mock('#/front/ui/feedback/Toaster', () => ({ toast: { error: vi.fn() } }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const tile = (
  id: string,
  below: Partial<Pick<SystemTile, 'branches' | 'leaves' | 'context'>> = {},
): SystemTile => ({
  _tag: 'Tile',
  id,
  title: id,
  preview: `What ${id} is`,
  body: `# ${id}`,
  branches: {},
  leaves: {},
  context: {},
  ...below,
})

/** A Leaf imported from a file that isn't Markdown: its Title its Name, no Preview, its content. */
const runYaml = { ...tile('run.yaml'), name: 'run.yaml', preview: '', body: 'version: 1\n' }

const system = tile('root', {
  branches: {
    1: tile('bare'),
    2: tile('holding', { leaves: { 1: tile('inner') } }),
    3: tile('framed', { context: { [-1]: tile('why') } }),
  },
  leaves: { 1: tile('notes'), 4: runYaml },
  context: { [-2]: tile('principles') },
})

function render(id: string) {
  const client = makeQueryClient()
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
  return renderHook(() => useCenteredTileState(system, id), { wrapper }).result
}

describe('what the card offers', () => {
  it('grows a Leaf into a Branch', () => {
    expect(render('notes').current.kindChange?.label).toBe(m.system_grow())
  })

  it('shrinks a Branch with nothing below it into a Leaf', () => {
    expect(render('bare').current.kindChange?.label).toBe(m.system_shrink())
  })

  it('offers no shrink to a Branch holding a Child or a Context Tile', () => {
    expect(render('holding').current.kindChange).toBeUndefined()
    expect(render('framed').current.kindChange).toBeUndefined()
  })

  it('offers nothing to the Root, a Context Tile or an id no Tile has', () => {
    for (const id of ['root', 'principles', 'gone'])
      expect(render(id).current).toEqual({ code: undefined, kindChange: undefined })
  })
})

describe('what the card shows of a Body', () => {
  it('shows a Leaf that isn’t Markdown as its code', () => {
    expect(render('run.yaml').current.code).toBe('version: 1\n')
  })

  it('shows no code for a Markdown Leaf, nor a Branch', () => {
    expect(render('notes').current.code).toBeUndefined()
    expect(render('bare').current.code).toBeUndefined()
  })
})

describe('a change of kind', () => {
  const answering = (outcome: unknown) => {
    vi.mocked(Mapping.moveTile).mockResolvedValue(outcome as never)
    vi.mocked(Mapping.system).mockResolvedValue({ ok: true, value: system } as never)
  }

  it('moves a Leaf to the Branch slot of its own Direction', async () => {
    answering({ ok: true, value: undefined })
    const result = render('run.yaml')
    act(() => {
      result.current.kindChange?.change()
    })
    await waitFor(() => {
      expect(Mapping.moveTile).toHaveBeenCalledWith({
        data: { id: 'run.yaml', parent: 'root', slot: 4 },
      })
    })
  })

  it('moves a bare Branch to the Leaf slot of its own Direction', async () => {
    answering({ ok: true, value: undefined })
    const result = render('bare')
    act(() => {
      result.current.kindChange?.change()
    })
    await waitFor(() => {
      expect(Mapping.moveTile).toHaveBeenCalledWith({
        data: { id: 'bare', parent: 'root', slot: { leaf: 1 } },
      })
    })
  })

  it('is on its way until the move settles, and a second press sends nothing', async () => {
    const settles: ((outcome: unknown) => void)[] = []
    vi.mocked(Mapping.moveTile).mockReturnValue(
      new Promise((resolve) => settles.push(resolve)) as never,
    )
    const result = render('notes')
    act(() => {
      result.current.kindChange?.change()
    })
    await waitFor(() => {
      expect(result.current.kindChange?.pending).toBe(true)
    })
    act(() => {
      result.current.kindChange?.change()
    })
    settles[0]?.({ ok: true, value: undefined })
    await waitFor(() => {
      expect(result.current.kindChange?.pending).toBe(false)
    })
    expect(Mapping.moveTile).toHaveBeenCalledTimes(1)
  })

  it('shows a taken Direction in a toast, and stays offered', async () => {
    answering({
      ok: false,
      failure: { _tag: 'DirectionTaken', kind: 'Conflict' },
      requestId: 'req-1',
    })
    const result = render('notes')
    act(() => {
      result.current.kindChange?.change()
    })
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(m.error_mapping_direction_taken())
    })
    expect(result.current.kindChange).toMatchObject({ label: m.system_grow(), pending: false })
  })
})
