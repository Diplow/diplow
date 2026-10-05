// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { Schema } from 'effect'
import { createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as Mapping from '#/api/mapping/mapping'
import type { ImportPlace } from '#/front/client/mapping/queries'
import { m } from '#/paraglide/messages'

import { useImportState } from './useImportState'

// The import's state over a stand-in for its server function: what a place takes, the pickers and
// the drop starting it, and the report it ends on, landed or refused, each line in the page's words.
// A refusal is what the client receives, its wire form, decoded.
vi.mock('#/api/mapping/mapping', async (original) => ({
  ImportUpload: (await original<typeof Mapping>()).ImportUpload,
  importTiles: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const parent = crypto.randomUUID()
const branchSlot: ImportPlace = { _tag: 'Slot', parent, slot: 3 }
const leafSlot: ImportPlace = { _tag: 'Slot', parent, slot: { leaf: 2 } }

function render(place: ImportPlace) {
  const client = new QueryClient()
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
  return renderHook(() => useImportState(place), { wrapper }).result
}

/** A folder as `<input webkitdirectory>` lists it, each file under the folder's name. */
function picked(files: Readonly<Record<string, string>>) {
  return Object.entries(files).map(([path, text]) =>
    Object.defineProperty(new File([text], path), 'webkitRelativePath', { value: `vault/${path}` }),
  ) as unknown as FileList
}

/** The server function answers this outcome, once. */
function answering(outcome: unknown) {
  vi.mocked(Mapping.importTiles).mockResolvedValue(outcome as never)
}

/** What the server function was sent, decoded as its handler decodes it. */
function sent() {
  const [[{ data }]] = vi.mocked(Mapping.importTiles).mock.calls as unknown as [
    [{ data: FormData }],
  ]
  return Schema.decodeUnknownSync(Mapping.ImportUpload)(data)
}

describe('what a place takes', () => {
  it('is anything in a Branch or a Context slot and as the Root, one file alone in a Leaf slot', () => {
    expect(render(branchSlot).current.state).toMatchObject({ phase: 'choosing', fileOnly: false })
    expect(render({ _tag: 'Root' }).current.state.fileOnly).toBe(false)
    expect(render(leafSlot).current.state.fileOnly).toBe(true)
  })
})

describe('an import', () => {
  it('lands a picked folder, then reports the Tiles created and every file left behind', async () => {
    answering({
      ok: true,
      value: {
        id: 'v',
        tiles: 2,
        references: 0,
        skipped: [{ path: 'a/-CLAUDE.md', reason: 'Shadowed' }],
      },
    })
    const result = render(branchSlot)
    act(() => {
      result.current.actions.pickFolder(picked({ 'CLAUDE.md': '# Vault', '.env': 'x' }))
    })
    await waitFor(() => {
      expect(result.current.state).toEqual({
        fileOnly: false,
        phase: 'landed',
        tiles: 2,
        leftOut: [
          { where: '.env', why: m.system_import_reason_dot_file() },
          { where: 'a/-CLAUDE.md', why: m.system_import_reason_shadowed() },
        ],
      })
    })
    expect(sent()).toMatchObject({ as: 'Zip', place: branchSlot, upload: { name: 'vault.zip' } })
  })

  it('reports a refusal, every fault on its path or on the whole import, nothing written', async () => {
    answering({
      ok: false,
      failure: {
        _tag: 'ImportRefused',
        kind: 'Invalid',
        fields: ['files'],
        faults: [
          { path: 'CLAUDE.md', fault: 'PreviewTooLong' },
          { path: '', fault: 'NothingToImport' },
        ],
      },
      requestId: 'req-1',
    })
    const result = render({ _tag: 'Root' })
    act(() => {
      result.current.actions.pickFile([new File(['x'], 'notes.md')] as unknown as FileList)
    })
    await waitFor(() => {
      expect(result.current.state).toMatchObject({
        phase: 'refused',
        faults: [
          { where: 'CLAUDE.md', why: m.system_import_fault_preview_too_long() },
          { where: m.system_import_whole(), why: m.system_import_fault_nothing_to_import() },
        ],
        leftOut: [],
      })
    })
    act(() => {
      result.current.actions.again()
    })
    await waitFor(() => {
      expect(result.current.state.phase).toBe('choosing')
    })
  })

  it('refuses before sending what the server would refuse, saying why', async () => {
    const result = render(branchSlot)
    act(() => {
      result.current.actions.pickFile([new File(['PK'], 'vault.zip')] as unknown as FileList)
    })
    await waitFor(() => {
      expect(result.current.state).toMatchObject({
        phase: 'refused',
        faults: [
          { where: m.system_import_whole(), why: m.system_import_fault_archive_unreadable() },
        ],
      })
    })
    expect(Mapping.importTiles).not.toHaveBeenCalled()
  })

  it('sends a zip into a Leaf slot as one file alone', async () => {
    answering({ ok: true, value: { id: 'l', tiles: 1, references: 0, skipped: [] } })
    const result = render(leafSlot)
    act(() => {
      result.current.actions.pickFile([new File(['PK'], 'notes.zip')] as unknown as FileList)
    })
    await waitFor(() => {
      expect(result.current.state.phase).toBe('landed')
    })
    expect(sent()).toMatchObject({ as: 'File', place: leafSlot })
  })

  it('takes what a drop holds', async () => {
    answering({ ok: true, value: { id: 'n', tiles: 1, references: 0, skipped: [] } })
    const result = render(branchSlot)
    const file = new File(['# Notes'], 'notes.md')
    const transfer = {
      items: [{ kind: 'file', webkitGetAsEntry: () => null, getAsFile: () => file }],
    } as unknown as DataTransfer
    act(() => {
      result.current.actions.drop(transfer)
    })
    await waitFor(() => {
      expect(result.current.state.phase).toBe('landed')
    })
    expect(sent()).toMatchObject({ as: 'File' })
  })

  it('starts nothing on a pick or a drop that holds no file, nor while one is under way', async () => {
    let answer: (outcome: unknown) => void = () => undefined
    vi.mocked(Mapping.importTiles).mockReturnValue(
      new Promise((resolve) => {
        answer = resolve
      }) as never,
    )
    const result = render(branchSlot)
    act(() => {
      result.current.actions.pickFolder(null)
      result.current.actions.pickFile(null)
      result.current.actions.drop({ items: [] } as unknown as DataTransfer)
    })
    expect(result.current.state.phase).toBe('choosing')
    const note = [new File(['# Note'], 'note.md')] as unknown as FileList
    act(() => {
      result.current.actions.pickFile(note)
    })
    await waitFor(() => {
      expect(Mapping.importTiles).toHaveBeenCalledOnce()
    })
    expect(result.current.state.phase).toBe('importing')
    act(() => {
      result.current.actions.pickFile(note)
    })
    answer({ ok: true, value: { id: 'n', tiles: 1, references: 0, skipped: [] } })
    await waitFor(() => {
      expect(result.current.state.phase).toBe('landed')
    })
    expect(Mapping.importTiles).toHaveBeenCalledOnce()
  })

  it('goes back to the pickers once a failure went to its channel', async () => {
    answering({ ok: false, failure: { _tag: 'DirectionTaken', kind: 'Conflict' }, requestId: 'r' })
    const result = render(branchSlot)
    act(() => {
      result.current.actions.pickFile([new File(['# Note'], 'note.md')] as unknown as FileList)
    })
    await waitFor(() => {
      expect(Mapping.importTiles).toHaveBeenCalledOnce()
    })
    await waitFor(() => {
      expect(result.current.state.phase).toBe('choosing')
    })
  })
})
