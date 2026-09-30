// Mapping on the client: one TanStack Query hook per read and per write, over its server functions
// (./mapping.ts). The System is one query, read whole; every write reads it again once it settles,
// failed or not, since a refusal (a slot taken meanwhile, a Tile gone) says the page is behind.
// Failures go to their channels (../../client/channels.ts): a hook's caller handles none.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { read, write } from '../../client/calls'
import { submitWrite } from '../../client/channels'
import type { Failure, Outcome } from '../../errors/failure'
import {
  type NewReference,
  type NewTile,
  type ReferenceSlot,
  type TileEdit,
  type TileMove,
  type TileRef,
  createReference,
  createTile,
  deleteReference,
  deleteTile,
  editTile,
  moveTile,
  system,
} from './mapping'

/** The System's read, by the server function's name: every mode of its query key starts with it. */
const systemScope = 'system'

/**
 * The Account's System: its Root, the user, with everything below it. Shown inside a ReadBoundary,
 * where its failure appears; signed out, it sends the user to sign in.
 */
export const useSystem = () =>
  useQuery(read({ scope: systemScope, key: [], call: () => system({ data: undefined }) }))

/**
 * A Tile of the Account's System as the client holds it, with its Children by Direction, its Context
 * by slot, and everything below them. The System is its Root.
 */
export type SystemTile = NonNullable<ReturnType<typeof useSystem>['data']>

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

/** Adds a Tile in a free slot: a Child, or a Tile of its parent's Context. */
export const useCreateTile = () =>
  useSystemWrite('createTile', (data: typeof NewTile.Type) => createTile({ data }))

/** Changes any of a Tile's Title, Preview and Body. */
export const useEditTile = () =>
  useSystemWrite('editTile', (data: typeof TileEdit.Type) => editTile({ data }))

/** Moves a Tile, and everything below it, to a free slot. */
export const useMoveTile = () =>
  useSystemWrite('moveTile', (data: typeof TileMove.Type) => moveTile({ data }))

/** Deletes a Tile and everything below it; References to them stay, broken. */
export const useDeleteTile = () =>
  useSystemWrite('deleteTile', (data: typeof TileRef.Type) => deleteTile({ data }))

/** Puts a Reference to a Tile in a free Context slot. */
export const useCreateReference = () =>
  useSystemWrite('createReference', (data: typeof NewReference.Type) => createReference({ data }))

/** Empties a Context slot holding a Reference. */
export const useDeleteReference = () =>
  useSystemWrite('deleteReference', (data: typeof ReferenceSlot.Type) => deleteReference({ data }))

/** What a Tile's form edits: its Title, Preview and Body. */
export type TileContent = Pick<SystemTile, 'title' | 'preview' | 'body'>

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
  const fields = ['title', 'preview', 'body'] as const
  return Object.fromEntries(
    fields.flatMap((field) => (before[field] === after[field] ? [] : [[field, after[field]]])),
  )
}

/** A Tile form's submit, as `useCreateTileSubmit` and `useEditTileSubmit` return it. */
export type TileSubmit = ReturnType<typeof useSystemSubmit>
