// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { decodeFailure } from '#/api/errors/failure'
import { messageFor } from '#/api/errors/messages'
import * as Mapping from '#/api/mapping/mapping'

import { CallFailed } from '../calls'
import {
  useCreateReference,
  useCreateTile,
  useCreateTileSubmit,
  useDeleteReference,
  useDeleteTile,
  useEditTile,
  useEditTileSubmit,
  useMoveTile,
  useSystem,
} from './queries'

// The hooks over stand-ins for the server functions: what each calls, what it answers, and when the
// System is read again. The server functions themselves are covered in src/api/mapping/mapping.test.ts.
// A refusal is what the client receives, its wire form: the front never imports a domain.
vi.mock('#/api/mapping/mapping', () => ({
  system: vi.fn(),
  createTile: vi.fn(),
  editTile: vi.fn(),
  moveTile: vi.fn(),
  deleteTile: vi.fn(),
  createReference: vi.fn(),
  deleteReference: vi.fn(),
}))

const titleMissing = { _tag: 'TitleMissing', kind: 'Invalid', fields: ['title'] } as const

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const root = {
  _tag: 'Tile',
  id: 'root',
  title: '',
  preview: '',
  body: '',
  children: {},
  context: {},
}

/** Each server function stand-in answers `value`; the System's answers the Root. */
function answering(value: unknown) {
  const ok = (answer: unknown) => () => Promise.resolve({ ok: true, value: answer })
  vi.mocked(Mapping.system).mockImplementation(ok(root) as never)
  for (const call of [
    Mapping.createTile,
    Mapping.editTile,
    Mapping.moveTile,
    Mapping.deleteTile,
    Mapping.createReference,
    Mapping.deleteReference,
  ]) {
    vi.mocked(call).mockImplementation(ok(value) as never)
  }
}

/** Renders `hook` beside the System's read, under a QueryClient of its own. */
function render<T>(hook: () => T) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
  return renderHook(() => ({ system: useSystem(), hook: hook() }), { wrapper })
}

/** A write hook's case: its server function, an input it takes, and the hook, ready to send it. */
function writing<I>(
  name: keyof typeof Mapping,
  useWrite: () => { mutateAsync: (input: I) => Promise<unknown> },
  input: I,
) {
  const use = () => {
    const { mutateAsync } = useWrite()
    return () => mutateAsync(input)
  }
  return { name, input, use }
}

describe("Mapping's hooks", () => {
  it('read the System through its server function', async () => {
    answering(undefined)
    const { result } = render(() => undefined)
    await waitFor(() => {
      expect(result.current.system.data).toEqual(root)
    })
    expect(Mapping.system).toHaveBeenCalledWith({ data: undefined })
  })

  it.each([
    writing('createTile', useCreateTile, {
      parent: 'root',
      slot: 1,
      title: 'A',
      preview: '',
      body: '',
    }),
    writing('editTile', useEditTile, { id: 't', body: '# A' }),
    writing('moveTile', useMoveTile, { id: 't', parent: 'root', slot: -2 }),
    writing('deleteTile', useDeleteTile, { id: 't' }),
    writing('createReference', useCreateReference, { parent: 'root', slot: -1, target: 't' }),
    writing('deleteReference', useDeleteReference, { parent: 'root', slot: -1 }),
  ])('write through $name, then read the System again', async ({ name, input, use }) => {
    answering({ id: 't' })
    const { result } = render(use)
    await waitFor(() => {
      expect(result.current.system.isSuccess).toBe(true)
    })
    await expect(result.current.hook()).resolves.toEqual({ id: 't' })
    expect(Mapping[name]).toHaveBeenCalledWith({ data: input })
    expect(Mapping.system).toHaveBeenCalledTimes(2)
  })

  it('throw a refusal as a CallFailed holding it, and read the System again all the same', async () => {
    answering(undefined)
    vi.mocked(Mapping.deleteTile).mockResolvedValue({
      ok: false,
      failure: { _tag: 'TileNotFound', kind: 'NotFound' },
      requestId: 'req-1',
    })
    const { result } = render(useDeleteTile)
    await waitFor(() => {
      expect(result.current.system.isSuccess).toBe(true)
    })
    const failed = await result.current.hook
      .mutateAsync({ id: 'gone' })
      .catch((error: unknown) => error)
    expect(failed).toBeInstanceOf(CallFailed)
    expect(failed).toMatchObject({
      scope: 'deleteTile',
      failure: decodeFailure({ _tag: 'TileNotFound', kind: 'NotFound' }),
      requestId: 'req-1',
    })
    expect(Mapping.system).toHaveBeenCalledTimes(2)
  })
})

describe("Mapping's form submits", () => {
  const content = { title: 'A', preview: 'What A is', body: '' }

  /** Renders a submit hook beside the System's read, once the System is read. */
  async function submitting(hook: () => (form: { value: typeof content }) => Promise<unknown>) {
    const { result } = render(hook)
    await waitFor(() => {
      expect(result.current.system.isSuccess).toBe(true)
    })
    return (value: typeof content) => result.current.hook({ value })
  }

  it('create a Tile in the slot the form was opened on, then read the System again', async () => {
    answering({ id: 't' })
    const onSaved = vi.fn()
    const submit = await submitting(() =>
      useCreateTileSubmit({ parent: 'root', slot: -3 }, onSaved),
    )
    await expect(submit(content)).resolves.toBeUndefined()
    expect(Mapping.createTile).toHaveBeenCalledWith({
      data: { parent: 'root', slot: -3, ...content },
    })
    expect(onSaved).toHaveBeenCalledOnce()
    await waitFor(() => {
      expect(Mapping.system).toHaveBeenCalledTimes(2)
    })
  })

  it('send only the fields an edit changed', async () => {
    answering({ id: 't' })
    const tile = { id: 't', title: '', preview: '', body: '' }
    const submit = await submitting(() => useEditTileSubmit(tile, vi.fn()))
    await submit({ title: '', preview: '', body: '# Me' })
    expect(Mapping.editTile).toHaveBeenCalledWith({ data: { id: 't', body: '# Me' } })
  })

  it('show a refusal on the field it names, and read the System again all the same', async () => {
    answering(undefined)
    vi.mocked(Mapping.editTile).mockResolvedValue({
      ok: false,
      failure: titleMissing,
      requestId: 'req-1',
    })
    const onSaved = vi.fn()
    const tile = { id: 't', ...content }
    const submit = await submitting(() => useEditTileSubmit(tile, onSaved))
    await expect(submit({ ...content, title: ' ' })).resolves.toEqual({
      fields: { title: messageFor(decodeFailure(titleMissing), 'editTile') },
    })
    expect(onSaved).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(Mapping.system).toHaveBeenCalledTimes(2)
    })
  })
})
