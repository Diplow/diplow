// Mapping on the client: one TanStack Query hook per read and per write, and the export, over its
// server functions (src/api/mapping/mapping.ts). The System is one query, read whole and flat, whose
// tree the client builds. Every write to it is a mutation keyed by its Operation's name, whose
// variables are that Operation's fields; the Tile forms' included. The writes run one after another,
// in order, and each reads the System again once it settles, failed or not, since a refusal (a slot
// taken meanwhile, a Tile gone) says the page is behind.
// Failures go to their channels (../channels.ts): a hook's caller handles none.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Schema } from 'effect'

import type { Failure, Outcome } from '#/api/errors/failure'
import { type System, type SystemTile, systemOf } from '#/domains/mapping/entities'
import type { OperationName } from '#/domains/mapping/operations'
import { type Download, downloaded } from '#/api/mapping/files/download'
import { type Given, type LeftOut, type Prepared, prepared } from './upload'
import {
  ImportUpload,
  type NewReference,
  type NewTile,
  type ReferenceSlot,
  type TileDelete,
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

import { read, write, writing, type WriteCall } from '../calls'
import { type FormErrors, settleSubmit, submitMutation } from '../channels'

/** The System's read, by the server function's name: every mode of its query key starts with it. */
const systemScope = 'system'

/** The queue every write to the System waits its turn in, so they reach the server in order. */
const systemQueue = 'system'

/** The System as the server reads it, flat, and its tree, the Root with everything below it. */
const withTree = (flat: System) => ({ system: flat, root: systemOf(flat) })

/**
 * The Account's System: as the server reads it, flat, which the cache holds, and its tree, its Root,
 * the user, with everything below it, built once per answer. Shown inside a ReadBoundary, where its
 * failure appears; signed out, it sends the user to sign in.
 */
export const useSystem = () =>
  useQuery({
    ...read({ scope: systemScope, key: [], call: () => system({ data: undefined }) }),
    select: withTree,
  })

/**
 * Help whole, in the page's language, Bodies included, read as the System is. Anyone reads it, so it
 * never sends the user to sign in.
 */
export const useHelp = (language: Locale) =>
  useQuery(read({ scope: 'help', key: [language], call: () => help({ data: { language } }) }))

/**
 * A write to the System, scoped by the Operation it runs and queued behind the writes made before it,
 * after which the System is read again.
 */
function useSystemWrite<I, A, E extends Failure>(
  scope: OperationName,
  call: (input: I) => Promise<Outcome<A, E>>,
  as: WriteCall = 'write',
) {
  const client = useQueryClient()
  return useMutation({
    ...write(scope, call, { as, queue: systemQueue }),
    onSettled: () => client.invalidateQueries({ queryKey: [systemScope] }),
  })
}

/**
 * Adds a Tile in a free slot: a Branch, a Leaf, or a Tile of its parent's Context. A form's write, so
 * a refusal of what the Tile says shows on the field at fault (`useCreateTileSubmit`).
 */
export const useCreateTile = () =>
  useSystemWrite('createTile', (data: typeof NewTile.Type) => createTile({ data }), 'submit')

/**
 * Changes any of a Tile's Title, Preview and Body. A form's write, so a refusal of what the Tile says
 * shows on the field at fault (`useEditTileSubmit`).
 */
export const useEditTile = () =>
  useSystemWrite('editTile', (data: typeof TileEdit.Type) => editTile({ data }), 'submit')

/** Moves a Tile, and everything below it, to a free slot. */
export const useMoveTile = () =>
  useSystemWrite('moveTile', (data: typeof TileMove.Type) => moveTile({ data }))

/** Two Tiles trade places, each with everything below it. */
export const useSwapTiles = () =>
  useSystemWrite('swapTiles', (data: typeof TileSwap.Type) => swapTiles({ data }))

/** Deletes a Tile and everything below it; References to them stay, broken. */
export const useDeleteTile = () =>
  useSystemWrite('deleteTile', (data: typeof TileDelete.Type) => deleteTile({ data }))

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
 * import was given; any other failure goes to a write's channel, a toast. It waits its turn behind
 * the System's other writes, and the System is read again once it settles.
 */
export const useImportTiles = () => {
  const client = useQueryClient()
  return useMutation({
    ...writing('importTiles', { queue: systemQueue }),
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

/** A Tile form's submit, as the form's `validators.onSubmitAsync`: what the form shows, if anything. */
export type TileSubmit = (form: { value: TileContent }) => Promise<FormErrors | undefined>

/**
 * Submits a new Tile's form through `useCreateTile`: the Tile goes in this free slot, a Child or a Tile
 * of the Context. A refusal shows on the fields it names, or in its channel.
 */
export const useCreateTileSubmit = (
  where: Pick<typeof NewTile.Type, 'parent' | 'slot'>,
  onSaved: () => void,
): TileSubmit => {
  const { mutateAsync } = useCreateTile()
  return submitMutation({
    mutate: (content: TileContent) => mutateAsync({ ...where, ...content }),
    onSaved,
  })
}

/**
 * Submits a Tile's form through `useEditTile`: only the fields that changed are sent, so the Body of
 * an untitled Root can be written before its name. A refusal shows on the fields it names, or in its
 * channel.
 */
export const useEditTileSubmit = (
  tile: TileContent & { id: string },
  onSaved: () => void,
): TileSubmit => {
  const { mutateAsync } = useEditTile()
  return submitMutation({
    mutate: (content: TileContent) => mutateAsync({ id: tile.id, ...changed(tile, content) }),
    onSaved,
  })
}

/** The fields of `after` that differ from `before`. */
function changed(before: TileContent, after: TileContent): Partial<TileContent> {
  return Object.fromEntries(
    contentFields.flatMap((field) =>
      before[field] === after[field] ? [] : [[field, after[field]]],
    ),
  )
}
