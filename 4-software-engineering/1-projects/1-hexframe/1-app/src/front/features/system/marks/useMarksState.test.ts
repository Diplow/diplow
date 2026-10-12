// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { Schema } from 'effect'
import { createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { conversationDay } from '#/api/assistant/assistant'
import type { Actor, Entry } from '#/domains/assistant/entities'
import type { System } from '#/domains/mapping/entities'
import { Batched, CreateTile } from '#/domains/mapping/operations'
import type { TileNode } from '#/front/ui/canvas/view/tiles'

import { useMarksState } from './useMarksState'

// What home's canvas marks, over a stand-in for the Conversation's server function: the chat pointing,
// a name's card shutting clearing its own Tile only; a Tile centered glinting; the Turn's location
// working; a change recorded after the page opened glinting, then a dot until its Tile is opened, one
// the page held first left alone; the user's acceptance of a Proposal they saw open glinting in their
// amber; and the open Proposal's create standing as a ghost, which a name's card says too.
vi.mock('#/api/assistant/assistant', () => ({ conversationDay: vi.fn() }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const id = { root: crypto.randomUUID(), work: crypto.randomUUID(), made: crypto.randomUUID() }

const system: System = {
  root: { _tag: 'Tile', id: id.root, title: 'Ada', preview: '', body: '', version: 1 },
  tiles: {
    [id.work]: {
      _tag: 'Tile',
      id: id.work,
      title: 'Work',
      preview: '',
      body: '',
      version: 1,
      parent: id.root,
      slot: 1,
    },
  },
  owned: true,
  version: 1,
}

const at = new Date('2026-10-12T10:00:00Z')

const change = (entry: string, actor: Actor): Entry => ({
  _tag: 'Change',
  id: entry,
  at,
  verb: 'TileEdited',
  tile: { id: id.work, title: 'Work' },
  actor,
})

const proposalEntry = (fate: 'open' | 'accepted'): Entry => ({
  _tag: 'Proposal',
  id: 'proposal-entry',
  at,
  proposal: 'proposal',
  changes: [{ _tag: 'Change', verb: 'TileEdited', tile: { id: id.work, title: 'Work' } }],
  fate,
})

/** The open Proposal as the day answers it: Tooling created under Work, in Direction 2. */
const open = {
  id: 'proposal',
  drafts: 1,
  writes: [
    Schema.encodeSync(Batched)({
      operation: new CreateTile({
        parent: id.work,
        slot: 2,
        title: 'Tooling',
        preview: 'Tools',
        body: '',
      }),
      made: id.made,
    }),
  ],
}

/** Today as the server answers it. */
const answering = (entries: Entry[], proposal?: typeof open) => {
  vi.mocked(conversationDay).mockResolvedValue({
    ok: true,
    value: {
      day: { date: '2026-10-12', offset: 0, nextOffset: 0 },
      entries,
      titles: {},
      ...(proposal && { proposal }),
    },
  } as never)
}

async function render(entries: Entry[], proposal?: typeof open, working?: string) {
  answering(entries, proposal)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
  const rendered = renderHook(() => useMarksState({ system, working }), { wrapper })
  await waitFor(() => {
    expect(conversationDay).toHaveBeenCalled()
  })
  /** Today read again, once the server holds these. */
  const readAgain = async (next: Entry[], nextProposal?: typeof open) => {
    answering(next, nextProposal)
    await act(() => client.invalidateQueries({ queryKey: ['conversationDay'] }))
  }
  return { ...rendered, readAgain }
}

describe('useMarksState, what crosses from the chat to the canvas', () => {
  it('lights the Tile pointed at, a card shutting clearing its own Tile only', async () => {
    const { result } = await render([])
    act(() => {
      result.current.actions.point('a', true)
      result.current.actions.point('b', true)
      result.current.actions.point('a', false)
    })
    expect(result.current.marks.pointed).toBe('b')
    act(() => {
      result.current.actions.pointRow(undefined)
    })
    expect(result.current.marks.pointed).toBeUndefined()
  })

  it('glints a Tile the chat centered, and runs the light round where the Turn works', async () => {
    const { result } = await render([], undefined, id.root)
    act(() => {
      result.current.actions.arrive(id.work)
    })
    expect(result.current.marks.tile?.(id.work)).toMatchObject({ glint: { by: 'human' } })
    expect(result.current.marks.tile?.(id.root)).toEqual({ working: true })
  })

  it('marks a change made since the page opened until its Tile is opened, not one held first', async () => {
    const { result, readAgain } = await render([change('before', { _tag: 'Assistant' })])
    await waitFor(() => {
      expect(result.current.cardOf(id.work)).toBeDefined()
    })
    expect(result.current.marks.tile?.(id.work)).toBeUndefined()
    await readAgain([
      change('before', { _tag: 'Assistant' }),
      change('after', { _tag: 'Assistant' }),
    ])
    await waitFor(() => {
      expect(result.current.marks.tile?.(id.work)).toEqual({
        glint: { by: 'agent', key: 'after' },
        unseen: 'agent',
      })
    })
    // Closing a ring leaves the dot; the glint has played, and doesn't rise again as the Tile remounts.
    act(() => {
      result.current.actions.went({ gesture: 'collapse', tile: id.work })
    })
    expect(result.current.marks.tile?.(id.work)).toEqual({ unseen: 'agent' })
    act(() => {
      result.current.actions.went({ gesture: 'center', tile: id.work })
    })
    expect(result.current.marks.tile?.(id.work)).toBeUndefined()
  })

  it("stands the open Proposal's create as a ghost, then glints its acceptance in the user's amber", async () => {
    const { result, readAgain } = await render([proposalEntry('open')], open)
    const parent: TileNode = { id: id.work, title: 'Work', preview: '' }
    await waitFor(() => {
      expect(result.current.marks.slot?.({ parent, ring: 'children', direction: 2 })).toEqual({
        id: id.made,
        look: { kind: 'ghost', words: { title: 'Tooling', preview: 'Tools' } },
      })
    })
    expect(result.current.cardOf(id.made)).toMatchObject({ description: 'Tools' })
    await readAgain([proposalEntry('accepted'), change('landed', { _tag: 'Assistant' })])
    await waitFor(() => {
      expect(result.current.marks.tile?.(id.work)).toEqual({
        glint: { by: 'human', key: 'landed' },
      })
    })
    expect(result.current.marks.slot?.({ parent, ring: 'children', direction: 2 })).toBeUndefined()
  })
})
