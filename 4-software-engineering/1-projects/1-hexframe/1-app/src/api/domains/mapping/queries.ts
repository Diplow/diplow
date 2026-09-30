// Mapping on the client: one TanStack Query hook per read and per write, over its server functions
// (./mapping.ts). The System is one query, read whole; every write reads it again once it settles,
// failed or not, since a refusal (a slot taken meanwhile, a Tile gone) says the page is behind.
// Failures go to their channels (../../client/channels.ts): a hook's caller handles none.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { read, write } from '../../client/calls'
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
