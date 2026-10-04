// The programs behind Mapping's server functions (./mapping.ts): each runs one of Mapping's operations
// for the Account the request's Session proves, or fails with IAM's `SignedOut`, and a change in the
// transaction it opens. They sit in a module of their own because they reach the domain and the
// database: the client imports the server functions, and only their handlers import this module,
// which Start strips from the client.
import { Effect } from 'effect'

import * as Iam from '#/domains/iam/iam'
import * as Mapping from '#/domains/mapping/mapping'
import { transactional } from '#/repositories/database/database'

/** Runs an operation for the signed-in Account: the one its Session proves, never one a caller sends. */
const forAccount = <A, E, R>(operation: (accountId: string) => Effect.Effect<A, E, R>) =>
  Effect.flatMap(Iam.signedIn, ({ account }) => operation(account.id))

/** Runs a change for the signed-in Account, in one transaction: it commits whole, or not at all. */
const changeForAccount = <A, E, R>(operation: (accountId: string) => Effect.Effect<A, E, R>) =>
  forAccount((accountId) => transactional(operation(accountId)))

/** Where a Tile goes, as Mapping takes it: a parent Tile's id and a slot under it. */
type Placement = Parameters<typeof Mapping.moveTile>[2]

/** A Context slot, as Mapping takes it: the id of the Tile that holds it and its slot, -1 to -6. */
type ReferenceSlot = Parameters<typeof Mapping.deleteReference>[1]

/** The Account's System: its Root, the user, with everything below it. */
export const system = forAccount(Mapping.system)

export const createTile = (input: Parameters<typeof Mapping.createTile>[1]) =>
  changeForAccount((accountId) => Mapping.createTile(accountId, input))

export const editTile = ({ id, ...changes }: { id: string } & Partial<Mapping.Content>) =>
  changeForAccount((accountId) => Mapping.editTile(accountId, id, changes))

export const moveTile = ({ id, ...to }: { id: string } & Placement) =>
  changeForAccount((accountId) => Mapping.moveTile(accountId, id, to))

export const deleteTile = ({ id }: { id: string }) =>
  changeForAccount((accountId) => Mapping.deleteTile(accountId, id))

export const createReference = (input: ReferenceSlot & { target: string }) =>
  changeForAccount((accountId) => Mapping.createReference(accountId, input))

export const deleteReference = (input: ReferenceSlot) =>
  changeForAccount((accountId) => Mapping.deleteReference(accountId, input))
