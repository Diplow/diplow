// The programs behind Mapping's server functions (./mapping.ts): each runs one of Mapping's operations
// for the Account the request's Session proves, or fails with IAM's `SignedOut`. They sit in a module
// of their own because they reach the domain and its repository: the client imports the server
// functions, and only their handlers import this module, which Start strips from the client.
import { Effect } from 'effect'

import * as Iam from '#/domains/iam/iam'
import * as Mapping from '#/domains/mapping/mapping'

/** Runs an operation for the signed-in Account: the one its Session proves, never one a caller sends. */
const forAccount = <A, E, R>(operation: (accountId: string) => Effect.Effect<A, E, R>) =>
  Effect.flatMap(Iam.signedIn, ({ account }) => operation(account.id))

type Placement = Parameters<typeof Mapping.moveTile>[2]
type ReferenceSlot = Parameters<typeof Mapping.deleteReference>[1]

/** The Account's System: its Root, the user, with everything below it. */
export const system = forAccount(Mapping.system)

export const createTile = (input: Parameters<typeof Mapping.createTile>[1]) =>
  forAccount((accountId) => Mapping.createTile(accountId, input))

export const editTile = ({ id, ...changes }: { id: string } & Partial<Mapping.Content>) =>
  forAccount((accountId) => Mapping.editTile(accountId, id, changes))

export const moveTile = ({ id, ...to }: { id: string } & Placement) =>
  forAccount((accountId) => Mapping.moveTile(accountId, id, to))

export const deleteTile = ({ id }: { id: string }) =>
  forAccount((accountId) => Mapping.deleteTile(accountId, id))

export const createReference = (input: ReferenceSlot & { target: string }) =>
  forAccount((accountId) => Mapping.createReference(accountId, input))

export const deleteReference = (input: ReferenceSlot) =>
  forAccount((accountId) => Mapping.deleteReference(accountId, input))
