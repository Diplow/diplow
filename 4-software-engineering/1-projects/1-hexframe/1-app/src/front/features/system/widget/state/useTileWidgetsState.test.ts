// @vitest-environment happy-dom
import { QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as Mapping from '#/api/mapping/mapping'
import { makeQueryClient } from '#/front/client/channels'

import { type Receipt, useTileWidgetsState } from './useTileWidgetsState'

// What follows a tile's widget in the chat, over a stand-in for the export's server function: a
// receipt once a form is sent, gone once another form opens or one closes unsent; an export working,
// then saved under its file's name, or failed, then let go; and the pseudo a new account types.
vi.mock('#/api/mapping/mapping', () => ({ exportTile: vi.fn() }))
vi.mock('#/front/ui/atoms/Toaster', () => ({ toast: { error: vi.fn() } }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function render() {
  const client = makeQueryClient()
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
  const { result } = renderHook(useTileWidgetsState, { wrapper })
  return {
    result,
    run: (action: (actions: (typeof result.current)['actions']) => void) => {
      act(() => {
        action(result.current.actions)
      })
    },
  }
}

const receipt: Receipt = {
  kind: 'receipt',
  key: 'add:root',
  session: { kind: 'add', parent: 'root' },
  did: 'created',
  tile: { id: 'tooling', title: 'Tooling' },
  where: { parent: 'Ada', kind: 'branch', place: 6, free: [6] },
  at: new Date(0),
}

const tooling = { tile: { id: 'tooling', title: 'Tooling' }, below: 3 }

describe('what follows a tile widget', () => {
  it('is the receipt a sent form leaves, until another form opens', () => {
    const { result, run } = render()
    expect(result.current.state.shown).toBeUndefined()
    run((actions) => {
      actions.sent(receipt)
    })
    expect(result.current.state.shown).toEqual(receipt)
    run((actions) => {
      actions.clear()
    })
    expect(result.current.state.shown).toBeUndefined()
  })

  it("goes once its Tile's write is refused, and stays for another Tile's", () => {
    const { result, run } = render()
    run((actions) => {
      actions.sent(receipt)
      actions.refused('another')
    })
    expect(result.current.state.shown).toEqual(receipt)
    run((actions) => {
      actions.refused('tooling')
    })
    expect(result.current.state.shown).toBeUndefined()
  })

  it('is nothing once a form closes unsent', () => {
    const { result, run } = render()
    run((actions) => {
      actions.sent(receipt)
      actions.clear()
    })
    expect(result.current.state.shown).toBeUndefined()
  })
})

describe('an export', () => {
  it('works, then shows the file it saved under, the menu waiting meanwhile', async () => {
    let answer: (response: Response) => void = () => undefined
    vi.mocked(Mapping.exportTile).mockReturnValue(
      new Promise((resolve) => {
        answer = resolve
      }) as never,
    )
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:tooling')
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    const { result, run } = render()
    run((actions) => {
      actions.sent(receipt)
      actions.export(tooling)
    })
    await waitFor(() => {
      expect(Mapping.exportTile).toHaveBeenCalledWith({ data: { id: 'tooling' } })
    })
    expect(result.current.state.exporting).toBe(true)
    expect(result.current.state.shown).toMatchObject({ ...tooling, phase: 'working' })
    answer(
      new Response('PK', {
        headers: { 'content-disposition': 'attachment; filename="tooling.zip"' },
      }),
    )
    await waitFor(() => {
      expect(result.current.state.shown).toMatchObject({ phase: 'done', file: 'tooling.zip' })
    })
    expect(result.current.state.exporting).toBe(false)
  })

  it('fails, then is let go', async () => {
    vi.mocked(Mapping.exportTile).mockResolvedValue({
      ok: false,
      failure: { _tag: 'TileNotFound', kind: 'NotFound' },
      requestId: 'req-1',
    } as never)
    const { result, run } = render()
    run((actions) => {
      actions.export(tooling)
    })
    await waitFor(() => {
      expect(result.current.state.shown).toMatchObject({ phase: 'failed', file: undefined })
    })
    run((actions) => {
      actions.clear()
    })
    expect(result.current.state.shown).toBeUndefined()
  })

  it('runs to its end once let go, the menu still waiting for it', async () => {
    let answer: (response: Response) => void = () => undefined
    vi.mocked(Mapping.exportTile).mockReturnValue(
      new Promise((resolve) => {
        answer = resolve
      }) as never,
    )
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:tooling')
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    const { result, run } = render()
    run((actions) => {
      actions.export(tooling)
    })
    await waitFor(() => {
      expect(result.current.state.exporting).toBe(true)
    })
    run((actions) => {
      actions.clear()
    })
    expect(result.current.state).toEqual({
      shown: undefined,
      exporting: true,
      naming: '',
      later: false,
    })
    answer(
      new Response('PK', {
        headers: { 'content-disposition': 'attachment; filename="tooling.zip"' },
      }),
    )
    await waitFor(() => {
      expect(result.current.state.exporting).toBe(false)
    })
    expect(result.current.state.shown).toBeUndefined()
  })

  it('goes once a form is sent, its receipt in its place', async () => {
    vi.mocked(Mapping.exportTile).mockReturnValue(new Promise(() => undefined) as never)
    const { result, run } = render()
    run((actions) => {
      actions.export(tooling)
    })
    await waitFor(() => {
      expect(result.current.state.exporting).toBe(true)
    })
    run((actions) => {
      actions.sent(receipt)
    })
    expect(result.current.state.shown).toEqual(receipt)
  })
})

describe('the pseudo being typed', () => {
  it('is held for the canvas as it is typed, kept by a receipt, and gone once a form opens', () => {
    const { result, run } = render()
    expect(result.current.state.naming).toBe('')
    run((actions) => {
      actions.name('Uly')
    })
    expect(result.current.state.naming).toBe('Uly')
    run((actions) => {
      actions.sent(receipt)
    })
    expect(result.current.state.naming).toBe('Uly')
    run((actions) => {
      actions.clear()
    })
    expect(result.current.state.naming).toBe('')
  })

  it('is let be for the visit on later, what was typed going with it', () => {
    const { result, run } = render()
    run((actions) => {
      actions.name('Uly')
    })
    expect(result.current.state.later).toBe(false)
    run((actions) => {
      actions.putOff()
    })
    expect(result.current.state).toMatchObject({ naming: '', later: true })
  })
})
