// Mapping on the client: one TanStack Query hook per read and per write, and the export, over its
// server functions (src/api/mapping/mapping.ts). The System is one query, read whole; every write
// reads it again once it settles, failed or not, since a refusal (a slot taken meanwhile, a Tile gone)
// says the page is behind.
// Failures go to their channels (../channels.ts): a hook's caller handles none.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Schema } from 'effect'

import type { Failure, Outcome } from '#/api/errors/failure'
import type { SystemTile } from '#/domains/mapping/entities'
import { type Download, downloaded } from '#/api/mapping/files/download'
import { type Given, type LeftOut, type Prepared, prepared } from './upload'
import {
  ImportUpload,
  type NewReference,
  type NewTile,
  type ReferenceSlot,
  type TileEdit,
  type TileMove,
  type TileRef,
  type TileSwap,
  createReference,
  createTile,
  deleteReference,
  deleteTile,
  editTile,
  exportTile,
  help,
  importTiles,
  moveTile,
  swapTiles,
  system,
} from '#/api/mapping/mapping'

import type { Locale } from '#/paraglide/runtime'

import { read, write } from '../calls'
import { settleSubmit, submitWrite } from '../channels'

/** The System's read, by the server function's name: every mode of its query key starts with it. */
const systemScope = 'system'

/**
 * The Account's System: its Root, the user, with everything below it. Shown inside a ReadBoundary,
 * where its failure appears; signed out, it sends the user to sign in.
 */
export const useSystem = () =>
  useQuery(read({ scope: systemScope, key: [], call: () => system({ data: undefined }) }))

/**
 * Help whole, in the page's language, Bodies included, read as the System is. Anyone reads it, so it
 * never sends the user to sign in.
 */
export const useHelp = (language: Locale) =>
  useQuery(read({ scope: 'help', key: [language], call: () => help({ data: { language } }) }))

/** A write to the System, named by its scope, after which the System is read again. */
function useSystemWrite<I, A, E extends Failure>(
  scope: string,
  call: (input: I) => Promise<Outcome<A, E>>,
) {
  const client = useQueryClient()
  return useMutation({
    ...write(scope, call),
    onSettled: () => client.invalidateQueries({ queryKey: [systemScope] }),
  })
}

/** Adds a Tile in a free slot: a Branch, a Leaf, or a Tile of its parent's Context. */
export const useCreateTile = () =>
  useSystemWrite('createTile', (data: typeof NewTile.Type) => createTile({ data }))

/** Changes any of a Tile's Title, Preview and Body. */
export const useEditTile = () =>
  useSystemWrite('editTile', (data: typeof TileEdit.Type) => editTile({ data }))

/** Moves a Tile, and everything below it, to a free slot. */
export const useMoveTile = () =>
  useSystemWrite('moveTile', (data: typeof TileMove.Type) => moveTile({ data }))

/** Two Tiles trade places, each with everything below it. */
export const useSwapTiles = () =>
  useSystemWrite('swapTiles', (data: typeof TileSwap.Type) => swapTiles({ data }))

/** Deletes a Tile and everything below it; References to them stay, broken. */
export const useDeleteTile = () =>
  useSystemWrite('deleteTile', (data: typeof TileRef.Type) => deleteTile({ data }))

/** Puts a Reference to a Tile in a free Context slot. */
export const useCreateReference = () =>
  useSystemWrite('createReference', (data: typeof NewReference.Type) => createReference({ data }))

/** Empties a Context slot holding a Reference. */
export const useDeleteReference = () =>
  useSystemWrite('deleteReference', (data: typeof ReferenceSlot.Type) => deleteReference({ data }))

/**
 * Exports a Tile and everything below it, the whole System from the Root: the browser saves
 * `<slug>.zip`. Nothing changes, so the System is not read again; a refusal goes to a write's
 * channel, a toast.
 */
export const useExportTile = () =>
  useMutation({
    ...write('exportTile', async (data: typeof TileRef.Type) =>
      downloaded(await exportTile({ data })),
    ),
    onSuccess: save,
  })

/** Has the browser save a file, as a click on a link to it would. */
function save({ name, blob }: Download) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  // Some browsers read the file from its URL a while after the click: the URL outlives it by a minute.
  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 60_000)
}

/** Where an import lands: a free slot under a Tile, or the Root of an empty System. */
export type ImportPlace = (typeof ImportUpload.Type)['place']

/** What an import landed, as the server answers: the Tile it landed as, what it wrote and skipped. */
type ImportReport = Extract<Awaited<ReturnType<typeof importTiles>>, { ok: true }>['value']

/**
 * What an import came to: landed, with the server's report; or refused, by the browser before it sent
 * anything or by the server, every fault on its path, nothing written. Either way, what the browser
 * left out before sending.
 */
export type Imported =
  | {
      readonly _tag: 'Landed'
      readonly report: ImportReport
      readonly leftOut: ReadonlyArray<LeftOut>
    }
  | Extract<Prepared, { _tag: 'Refused' }>

/**
 * Imports what the user gave into a place of the System: the browser prunes and zips it, or refuses
 * it before sending (`./upload.ts`), then the server lands it, all of it or nothing.
 * The import is the form of its files, so its refusal, `ImportRefused`, is its answer, shown where the
 * import was given; any other failure goes to a write's channel, a toast. The System is read again
 * once it settles.
 */
export const useImportTiles = () => {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({
      given,
      place,
    }: {
      given: Given | Promise<Given>
      place: ImportPlace
    }): Promise<Imported> => {
      const ready = await prepared(await given)
      if (ready._tag === 'Refused') return ready
      const { upload, as, leftOut } = ready
      const form = Schema.encodeSync(ImportUpload)({ upload, as, place })
      const submitted = await settleSubmit('importTiles', importTiles({ data: form }))
      if (submitted.ok) return { _tag: 'Landed', report: submitted.value, leftOut }
      return { _tag: 'Refused', faults: submitted.failure.faults, leftOut }
    },
    onSettled: () => client.invalidateQueries({ queryKey: [systemScope] }),
  })
}

/** The fields a Tile's form edits, which an edit compares one by one. */
const contentFields = ['title', 'preview', 'body'] as const

/** What a Tile's form edits: its Title, Preview and Body, one per field above. */
export type TileContent = Pick<SystemTile, (typeof contentFields)[number]>

/**
 * A form's submit that writes to the System, as the form's `validators.onSubmitAsync`: a refusal shows
 * on the fields it names, or in its channel, and the System is read again once the write settles.
 */
function useSystemSubmit<A, E extends Failure>(
  scope: string,
  call: (content: TileContent) => Promise<Outcome<A, E>>,
  onSaved: () => void,
) {
  const client = useQueryClient()
  return submitWrite({
    scope,
    call: (content: TileContent) =>
      call(content).finally(() => {
        void client.invalidateQueries({ queryKey: [systemScope] })
      }),
    onSaved,
  })
}

/** Submits a new Tile's form: the Tile goes in this free slot, a Child or a Tile of the Context. */
export const useCreateTileSubmit = (
  where: Pick<typeof NewTile.Type, 'parent' | 'slot'>,
  onSaved: () => void,
) =>
  useSystemSubmit(
    'createTile',
    (content) => createTile({ data: { ...where, ...content } }),
    onSaved,
  )

/**
 * Submits a Tile's form: only the fields that changed are sent, so the Body of an untitled Root can
 * be written before its name.
 */
export const useEditTileSubmit = (tile: TileContent & { id: string }, onSaved: () => void) =>
  useSystemSubmit(
    'editTile',
    (content) => editTile({ data: { id: tile.id, ...changed(tile, content) } }),
    onSaved,
  )

/** The fields of `after` that differ from `before`. */
function changed(before: TileContent, after: TileContent): Partial<TileContent> {
  return Object.fromEntries(
    contentFields.flatMap((field) =>
      before[field] === after[field] ? [] : [[field, after[field]]],
    ),
  )
}

/** A Tile form's submit, as `useCreateTileSubmit` and `useEditTileSubmit` return it. */
export type TileSubmit = ReturnType<typeof useSystemSubmit>
