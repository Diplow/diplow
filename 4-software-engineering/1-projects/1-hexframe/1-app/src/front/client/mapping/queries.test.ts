// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider, useMutationState } from '@tanstack/react-query'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { Schema } from 'effect'
import { createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { decodeFailure } from '#/api/errors/failure'
import { TileId } from '#/domains/mapping/entities'
import { messageFor } from '#/api/errors/messages'
import * as Mapping from '#/api/mapping/mapping'
import { toast } from '#/front/ui/feedback/Toaster'
import { overwriteGetLocale } from '#/paraglide/runtime'

import { CallFailed } from '../calls'
import { makeQueryClient } from '../channels'
import {
  useCreateReference,
  useCreateTile,
  useCreateTileSubmit,
  useDeleteReference,
  useDeleteTile,
  useEditTile,
  useEditTileSubmit,
  useExportTile,
  useHelp,
  useImportTiles,
  useMoveTile,
  useSwapTiles,
  useSystem,
} from './queries'

// The hooks over stand-ins for the server functions: what each calls, what it answers, and when the
// System is read again. The server functions themselves are covered in src/api/mapping/mapping.test.ts.
// A refusal is what the client receives, its wire form, decoded.
vi.mock('#/api/mapping/mapping', async (original) => ({
  // The import's form is encoded by the server function's own schema.
  ImportUpload: (await original<typeof Mapping>()).ImportUpload,
  importTiles: vi.fn(),
  system: vi.fn(),
  help: vi.fn(),
  createTile: vi.fn(),
  editTile: vi.fn(),
  moveTile: vi.fn(),
  swapTiles: vi.fn(),
  deleteTile: vi.fn(),
  createReference: vi.fn(),
  deleteReference: vi.fn(),
  exportTile: vi.fn(),
}))

vi.mock('#/front/ui/feedback/Toaster', () => ({ toast: { error: vi.fn() } }))

const titleMissing = { _tag: 'TitleMissing', kind: 'Invalid', fields: ['title'] } as const

afterEach(() => {
  cleanup()
  overwriteGetLocale(() => 'en')
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

/** The Root, untitled, as a System's tree holds it. */
const root = {
  _tag: 'Tile',
  id: 'root',
  title: '',
  preview: '',
  body: '',
  branches: {},
  leaves: {},
  context: {},
}

/** The Root's System as the server reads it, flat: a Child in Direction 2 and a Reference to it. */
const system = {
  root: { _tag: 'Tile', id: 'root', title: '', preview: '', body: '' },
  tiles: {
    child: {
      _tag: 'Tile',
      id: 'child',
      title: 'Child',
      preview: '',
      body: '',
      parent: 'root',
      slot: 2,
    },
    reference: { _tag: 'Reference', id: 'reference', parent: 'root', slot: -1, target: 'child' },
  },
  owned: true,
} as const

/** The System read again after a write, told from the first read by its Root's Title. */
const readAgain = { ...system, root: { ...system.root, title: 'Read again' } } as const

/**
 * Each server function stand-in answers `value`; the System's answers the System above, then, read
 * again, `readAgain`.
 */
function answering(value: unknown) {
  const ok = (answer: unknown) => () => Promise.resolve({ ok: true, value: answer })
  vi.mocked(Mapping.system)
    .mockImplementationOnce(ok(system) as never)
    .mockImplementation(ok(readAgain) as never)
  for (const call of [
    Mapping.createTile,
    Mapping.editTile,
    Mapping.moveTile,
    Mapping.swapTiles,
    Mapping.deleteTile,
    Mapping.createReference,
    Mapping.deleteReference,
  ]) {
    vi.mocked(call).mockImplementation(ok(value) as never)
  }
}

/**
 * Renders `hook` beside the System's read, under a QueryClient of its own: a bare one, or the app's,
 * which carries each failure to its channel.
 */
function render<T>(
  hook: () => T,
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
  return renderHook(() => ({ system: useSystem(), hook: hook() }), { wrapper })
}

type Rendered = ReturnType<typeof render>['result']

/** The flat System the page shows. */
const shown = (result: Rendered) => result.current.system.data?.system

/** Waits for the first read of the System to land. */
async function read(result: Rendered) {
  await waitFor(() => {
    expect(shown(result)).toBeDefined()
  })
}

/** Waits for the page to show the System read again. */
async function readAgainShown(result: Rendered) {
  await waitFor(() => {
    expect(shown(result)).toEqual(readAgain)
  })
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
  it('read the System flat through its server function, and build its tree', async () => {
    answering(undefined)
    const { result } = render(() => undefined)
    const child = { _tag: 'Tile', id: 'child', title: 'Child', preview: '', body: '' }
    await waitFor(() => {
      expect(result.current.system.data).toEqual({
        system,
        root: {
          ...root,
          branches: { 2: { ...child, branches: {}, leaves: {}, context: {} } },
          context: {
            [-1]: {
              _tag: 'Reference',
              tile: { id: 'child', title: 'Child', preview: '', body: '' },
            },
          },
        },
      })
    })
    expect(Mapping.system).toHaveBeenCalledWith({ data: undefined })
  })

  it('read Help in the language asked, each language a query of its own', async () => {
    answering(undefined)
    vi.mocked(Mapping.help).mockImplementation((({ data }: { data: { language: string } }) =>
      Promise.resolve({ ok: true, value: { ...root, id: 'help', title: data.language } })) as never)
    const { result } = render(() => ({ en: useHelp('en'), fr: useHelp('fr') }))
    await waitFor(() => {
      expect(result.current.hook.fr.data).toMatchObject({ id: 'help', title: 'fr' })
    })
    expect(result.current.hook.en.data).toMatchObject({ id: 'help', title: 'en' })
    expect(Mapping.help).toHaveBeenCalledWith({ data: { language: 'en' } })
    expect(Mapping.help).toHaveBeenCalledWith({ data: { language: 'fr' } })
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
    writing('swapTiles', useSwapTiles, { a: 't', b: 'u' }),
    writing('deleteTile', useDeleteTile, { id: 't' }),
    writing('createReference', useCreateReference, { parent: 'root', slot: -1, target: 't' }),
    writing('deleteReference', useDeleteReference, { parent: 'root', slot: -1 }),
  ])('write through $name, then read the System again', async ({ name, input, use }) => {
    answering({ id: 't' })
    const { result } = render(use)
    await read(result)
    await expect(result.current.hook()).resolves.toEqual({ id: 't' })
    expect(Mapping[name]).toHaveBeenCalledWith({ data: input })
    await readAgainShown(result)
  })

  it('throw a refusal as a CallFailed holding it, and read the System again all the same', async () => {
    answering(undefined)
    vi.mocked(Mapping.deleteTile).mockResolvedValue({
      ok: false,
      failure: { _tag: 'TileNotFound', kind: 'NotFound' },
      requestId: 'req-1',
    })
    const { result } = render(useDeleteTile)
    await read(result)
    const failed = await result.current.hook
      .mutateAsync({ id: 'gone' })
      .catch((error: unknown) => error)
    expect(failed).toBeInstanceOf(CallFailed)
    expect(failed).toMatchObject({
      scope: 'deleteTile',
      failure: decodeFailure({ _tag: 'TileNotFound', kind: 'NotFound' }),
      requestId: 'req-1',
    })
    await readAgainShown(result)
  })

  it('send the System’s writes one after another, each once the one before it settled', async () => {
    answering(undefined)
    let refuse: (outcome: Awaited<ReturnType<typeof Mapping.moveTile>>) => void = () => undefined
    vi.mocked(Mapping.moveTile).mockReturnValue(
      new Promise((resolve) => {
        refuse = resolve
      }),
    )
    const { result } = render(() => ({ move: useMoveTile(), edit: useEditTile() }))
    await read(result)
    const moved = result.current.hook.move
      .mutateAsync({ id: 't', parent: 'root', slot: 3 })
      .catch((error: unknown) => error)
    const edited = result.current.hook.edit.mutateAsync({ id: 't', title: 'B' })
    await waitFor(() => {
      expect(Mapping.moveTile).toHaveBeenCalled()
    })
    expect(Mapping.editTile).not.toHaveBeenCalled()
    refuse({ ok: false, failure: { _tag: 'DirectionTaken', kind: 'Conflict' }, requestId: 'r' })
    expect(await moved).toBeInstanceOf(CallFailed)
    await expect(edited).resolves.toBeUndefined()
    expect(Mapping.editTile).toHaveBeenCalledWith({ data: { id: 't', title: 'B' } })
  })
})

describe('the export of a Tile', () => {
  it('has the browser save the zip under the name it came with, the System not read again', async () => {
    answering(undefined)
    const zip = new Response('PK', {
      headers: { 'content-disposition': 'attachment; filename="games.zip"' },
    })
    vi.mocked(Mapping.exportTile).mockResolvedValue(zip)
    const saved = vi.fn()
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:games')
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      saved(this.download, this.href)
    })
    const { result } = render(useExportTile)
    await read(result)
    await result.current.hook.mutateAsync({ id: 'games' })
    expect(Mapping.exportTile).toHaveBeenCalledWith({ data: { id: 'games' } })
    expect(saved).toHaveBeenCalledWith('games.zip', 'blob:games')
    expect(document.querySelector('a[download]')).toBeNull()
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(shown(result)).toEqual(system)
  })

  it('throws a refusal as a CallFailed holding it, and saves nothing', async () => {
    answering(undefined)
    vi.mocked(Mapping.exportTile).mockResolvedValue({
      ok: false,
      failure: { _tag: 'TileNotFound', kind: 'NotFound' },
      requestId: 'req-1',
    })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click')
    const { result } = render(useExportTile)
    const failed = await result.current.hook
      .mutateAsync({ id: 'gone' })
      .catch((error: unknown) => error)
    expect(failed).toMatchObject({ scope: 'exportTile', requestId: 'req-1' })
    expect(failed).toBeInstanceOf(CallFailed)
    expect(click).not.toHaveBeenCalled()
  })

  it('fails as Unexpected on a file that comes without its name, and saves nothing', async () => {
    answering(undefined)
    vi.mocked(Mapping.exportTile).mockResolvedValue(new Response('PK'))
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click')
    const { result } = render(useExportTile)
    const failed = await result.current.hook
      .mutateAsync({ id: 'games' })
      .catch((error: unknown) => error)
    expect(failed).toMatchObject({ scope: 'exportTile', failure: { _tag: 'Unexpected' } })
    expect(click).not.toHaveBeenCalled()
  })
})

describe('an import', () => {
  const folder = {
    _tag: 'Folder',
    name: 'vault',
    files: [
      { path: 'CLAUDE.md', kind: 'File', blob: () => Promise.resolve(new Blob(['# Vault'])) },
      { path: '.env', kind: 'File', blob: () => Promise.resolve(new Blob(['SECRET=x'])) },
    ],
  } as const
  const place = { _tag: 'Slot', parent: crypto.randomUUID(), slot: 2 } as const
  const report = { id: 'vault', tiles: 1, references: 0, skipped: [] }

  /** Renders the import beside the System's read, once the System is read. */
  async function importing() {
    answering(undefined)
    const { result } = render(useImportTiles)
    await read(result)
    return result
  }

  it('sends the folder pruned and zipped, as the form the server function decodes, then reads the System again', async () => {
    vi.mocked(Mapping.importTiles).mockResolvedValue({ ok: true, value: report } as never)
    const result = await importing()
    const imported = await result.current.hook.mutateAsync({
      given: Promise.resolve(folder),
      place,
    })
    expect(imported).toEqual({
      _tag: 'Landed',
      report,
      leftOut: [{ path: '.env', reason: 'DotFile' }],
    })
    const [[{ data }]] = vi.mocked(Mapping.importTiles).mock.calls as unknown as [
      [{ data: FormData }],
    ]
    expect(Schema.decodeUnknownSync(Mapping.ImportUpload)(data)).toMatchObject({
      as: 'Zip',
      place,
      upload: { name: 'vault.zip' },
    })
    await readAgainShown(result)
  })

  it('answers the server’s refusal with every fault, what was left out beside them', async () => {
    const faults = [{ path: 'CLAUDE.md', fault: 'PreviewTooLong' }]
    vi.mocked(Mapping.importTiles).mockResolvedValue({
      ok: false,
      failure: { _tag: 'ImportRefused', kind: 'Invalid', fields: ['files'], faults },
      requestId: 'req-2',
    } as never)
    const result = await importing()
    expect(await result.current.hook.mutateAsync({ given: folder, place })).toEqual({
      _tag: 'Refused',
      faults,
      leftOut: [{ path: '.env', reason: 'DotFile' }],
    })
  })

  it('answers the browser’s refusal without sending anything', async () => {
    const result = await importing()
    const big = new File([new Uint8Array(4_000_001)], 'big.md')
    expect(
      await result.current.hook.mutateAsync({ given: { _tag: 'File', file: big }, place }),
    ).toEqual({
      _tag: 'Refused',
      faults: [{ path: '', fault: 'UploadTooLarge' }],
      leftOut: [],
    })
    expect(Mapping.importTiles).not.toHaveBeenCalled()
  })

  it('waits its turn behind a write to the System made before it', async () => {
    answering(undefined)
    let moved: (outcome: Awaited<ReturnType<typeof Mapping.moveTile>>) => void = () => undefined
    vi.mocked(Mapping.moveTile).mockReturnValue(
      new Promise((resolve) => {
        moved = resolve
      }),
    )
    vi.mocked(Mapping.importTiles).mockResolvedValue({ ok: true, value: report } as never)
    const { result } = render(() => ({ move: useMoveTile(), import: useImportTiles() }))
    await read(result)
    const moving = result.current.hook.move.mutateAsync({ id: 't', parent: 'root', slot: 3 })
    const imported = result.current.hook.import.mutateAsync({ given: folder, place })
    await waitFor(() => {
      expect(Mapping.moveTile).toHaveBeenCalled()
    })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(Mapping.importTiles).not.toHaveBeenCalled()
    moved({ ok: true, value: undefined })
    await moving
    await expect(imported).resolves.toMatchObject({ _tag: 'Landed', report })
  })

  it('throws any other failure as a CallFailed, for a write’s channel', async () => {
    vi.mocked(Mapping.importTiles).mockResolvedValue({
      ok: false,
      failure: { _tag: 'DirectionTaken', kind: 'Conflict' },
      requestId: 'req-3',
    } as never)
    const result = await importing()
    const file = new File(['# Notes'], 'notes.md')
    const failed = await result.current.hook
      .mutateAsync({ given: { _tag: 'File', file }, place })
      .catch((error: unknown) => error)
    expect(failed).toBeInstanceOf(CallFailed)
    expect(failed).toMatchObject({ scope: 'importTiles', failure: { _tag: 'DirectionTaken' } })
  })
})

describe("Mapping's form submits", () => {
  const content = { title: 'A', preview: 'What A is', body: '' }

  /**
   * Renders a submit hook beside the System's read, under the app's QueryClient, once the System is
   * read; and what the MutationCache holds of the System's writes, as the canvas will read them.
   */
  async function submitting(hook: () => (form: { value: typeof content }) => Promise<unknown>) {
    const { result } = render(
      () => ({
        submit: hook(),
        writes: useMutationState({
          filters: { mutationKey: [] },
          select: ({ options, state }) => ({
            key: options.mutationKey,
            status: state.status,
            variables: state.variables,
          }),
        }),
      }),
      makeQueryClient(),
    )
    await read(result)
    return Object.assign((value: typeof content) => result.current.hook.submit({ value }), {
      writes: () => result.current.hook.writes,
      shown: () => shown(result),
    })
  }

  it('create a Tile in the slot the form was opened on, under an id of its choosing, as a mutation', async () => {
    answering({ id: 't' })
    const onSaved = vi.fn()
    const submit = await submitting(() =>
      useCreateTileSubmit({ parent: 'root', slot: -3 }, onSaved),
    )
    await expect(submit(content)).resolves.toBeUndefined()
    const [[{ data }]] = vi.mocked(Mapping.createTile).mock.calls as unknown as [
      [{ data: { id: string } }],
    ]
    const chosen = data.id
    expect(Schema.is(TileId)(chosen)).toBe(true)
    expect(data).toEqual({ id: chosen, parent: 'root', slot: -3, ...content })
    expect(onSaved).toHaveBeenCalledOnce()
    await waitFor(() => {
      expect(submit.writes()).toEqual([
        {
          key: ['createTile'],
          status: 'success',
          variables: { id: chosen, parent: 'root', slot: -3, ...content },
        },
      ])
    })
  })

  it('send only the fields an edit changed', async () => {
    answering({ id: 't' })
    const tile = { id: 't', title: '', preview: '', body: '' }
    const submit = await submitting(() => useEditTileSubmit(tile, vi.fn()))
    await submit({ title: '', preview: '', body: '# Me' })
    expect(Mapping.editTile).toHaveBeenCalledWith({ data: { id: 't', body: '# Me' } })
  })

  it.each([
    ['en', 'Give this tile a title.'],
    ['fr', 'Donnez un titre à cette tuile.'],
  ] as const)(
    "show a refused create's message on the field it names, in %s, and no toast",
    async (language, message) => {
      overwriteGetLocale(() => language)
      answering(undefined)
      vi.mocked(Mapping.createTile).mockResolvedValue({
        ok: false,
        failure: titleMissing,
        requestId: 'req-1',
      })
      const onSaved = vi.fn()
      const submit = await submitting(() =>
        useCreateTileSubmit({ parent: 'root', slot: 1 }, onSaved),
      )
      await expect(submit({ ...content, title: ' ' })).resolves.toEqual({
        fields: { title: message },
      })
      expect(toast.error).not.toHaveBeenCalled()
      expect(onSaved).not.toHaveBeenCalled()
      await waitFor(() => {
        expect(submit.writes()).toMatchObject([{ key: ['createTile'], status: 'error' }])
      })
    },
  )

  it("show a refused edit's message on the field it names, and the System read again", async () => {
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
    expect(toast.error).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(submit.shown()).toEqual(readAgain)
    })
  })

  it('raise one toast for a refusal that names no field, and keep the form open', async () => {
    answering(undefined)
    vi.mocked(Mapping.editTile).mockResolvedValue({
      ok: false,
      failure: { _tag: 'TileNotFound', kind: 'NotFound' },
      requestId: 'req-1',
    })
    const onSaved = vi.fn()
    const submit = await submitting(() => useEditTileSubmit({ id: 't', ...content }, onSaved))
    await expect(submit({ ...content, body: '# B' })).resolves.toEqual({
      form: "This tile doesn't exist, or no longer does.",
    })
    expect(toast.error).toHaveBeenCalledExactlyOnceWith(
      "This tile doesn't exist, or no longer does.",
    )
    expect(onSaved).not.toHaveBeenCalled()
  })
})
