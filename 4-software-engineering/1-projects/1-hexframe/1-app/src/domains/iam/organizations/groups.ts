// An Organization's Groups of its own (HEX-137), beside its Members Group, which holds everyone and
// needs no row: each a set of its members, named once within it, whatever the case, never nested,
// seen with who is in it by every member, so they know who they share with, and changed by its admins
// alone, from a Session (`managedBy`), under the Organization's row's lock, so two changes decide one
// after the other. A Group's id is IAM's, a UUID, which a Grant names, opaque to Mapping: deleting
// the Group deletes its row and who was in it, never a Grant, so its id is in no answer of
// `belonging` from the next request on and its Grants resolve for nobody, with nothing written in the
// Systems that named it.
import { Effect } from 'effect'

import { Organizations } from '#/repositories/database/organizations/organizations'

import { groupNameOf, sameGroupName } from '../entities'
import {
  GroupNameInvalid,
  GroupNameTaken,
  GroupNotFound,
  MemberNotFound,
  OrganizationNotFound,
} from '../errors'
import { sessionOnly } from '../iam'
import { managedBy, roleIn } from './organizations'

/**
 * The Groups of an Organization, the earliest first, each with its members' Accounts, read by one of
 * its members from a Session: `OrganizationNotFound` for anyone else, as for an id no Organization
 * has.
 */
export const groups = (organization: string) =>
  Effect.gen(function* () {
    const { account } = yield* sessionOnly
    const found = yield* Organizations.use((organizations) => organizations.members(organization))
    if (roleIn(found, account.id) === undefined) return yield* new OrganizationNotFound()
    return yield* Organizations.use((organizations) => organizations.groupsOf(organization))
  })

/** The name a Group is given, trimmed, or `GroupNameInvalid` on its field. */
const nameOf = (name: string) => {
  const named = groupNameOf(name)
  return named === undefined
    ? Effect.fail(new GroupNameInvalid({ fields: ['name'] }))
    : Effect.succeed(named)
}

/**
 * The Groups of an Organization once its admin, from a Session, asks to change one, its row locked
 * until the transaction ends (`managedBy`), with its members.
 */
const changedBy = (organization: string) =>
  Effect.gen(function* () {
    const members = yield* managedBy(organization)
    const found = yield* Organizations.use((organizations) => organizations.groupsOf(organization))
    return { members, groups: found }
  })

/** `GroupNameTaken` when another Group of these has this name, whatever its case. */
const nameFree = (
  found: ReadonlyArray<{ readonly id: string; readonly name: string }>,
  name: string,
  group?: string,
) =>
  found.some((other) => other.id !== group && sameGroupName(other.name, name))
    ? Effect.fail(new GroupNameTaken({ fields: ['name'] }))
    : Effect.void

/** `GroupNotFound` for an id none of these Groups has. */
const oneOf = (found: ReadonlyArray<{ readonly id: string }>, group: string) =>
  found.some((one) => one.id === group) ? Effect.void : Effect.fail(new GroupNotFound())

/**
 * Creates a Group in an Organization, with nobody in it, by one of its admins from a Session, and
 * answers its id: `GroupNameInvalid` for a blank name or one past its bound, `GroupNameTaken` for one
 * another Group has. Inside a transaction.
 */
export const createGroup = (organization: string, name: string) =>
  Effect.gen(function* () {
    const { groups: found } = yield* changedBy(organization)
    const named = yield* nameOf(name)
    yield* nameFree(found, named)
    const id = crypto.randomUUID()
    yield* Organizations.use((organizations) =>
      organizations.addGroup(organization, { id, name: named }),
    )
    return id
  })

/**
 * Renames one of an Organization's Groups, by one of its admins from a Session: `GroupNotFound` for
 * an id none of its Groups has, and the name refused as `createGroup` refuses it. Inside a
 * transaction.
 */
export const renameGroup = (organization: string, group: string, name: string) =>
  Effect.gen(function* () {
    const { groups: found } = yield* changedBy(organization)
    yield* oneOf(found, group)
    const named = yield* nameOf(name)
    yield* nameFree(found, named, group)
    yield* Organizations.use((organizations) =>
      organizations.renameGroup(organization, { id: group, name: named }),
    )
  })

/**
 * Deletes one of an Organization's Groups, and who was in it, by one of its admins from a Session:
 * `GroupNotFound` for an id none of its Groups has. Its Grants are left where they are, resolving for
 * nobody. Inside a transaction.
 */
export const deleteGroup = (organization: string, group: string) =>
  Effect.gen(function* () {
    const { groups: found } = yield* changedBy(organization)
    yield* oneOf(found, group)
    yield* Organizations.use((organizations) => organizations.removeGroup(organization, group))
  })

/**
 * Puts one of an Organization's members in one of its Groups, or takes them out, by one of its
 * admins from a Session: `GroupNotFound` for an id none of its Groups has, `MemberNotFound` for an
 * Account not among its members. Putting someone in twice, or taking out someone not in it, changes
 * nothing. Holds from their next request on. Inside a transaction.
 */
export const setInGroup = (
  organization: string,
  {
    group,
    account,
    in: placed,
  }: { readonly group: string; readonly account: string; readonly in: boolean },
) =>
  Effect.gen(function* () {
    const { members, groups: found } = yield* changedBy(organization)
    yield* oneOf(found, group)
    if (roleIn(members, account) === undefined) return yield* new MemberNotFound()
    yield* Organizations.use((organizations) =>
      placed
        ? organizations.addToGroup(organization, { group, account })
        : organizations.removeFromGroup(organization, { group, account }),
    )
  })

/**
 * The Groups of an Organization's own some ids name, each with its name and its Organization, an id
 * of none left out: a deleted Group's included, which the API layer then names as gone. Read for the
 * owner of a Tile whose Grants name them, who reads who reaches it.
 */
export const groupsNamed = (ids: ReadonlyArray<string>) =>
  Effect.map(
    Organizations.use((organizations) => organizations.groupsNamed(ids)),
    (rows) =>
      new Map(rows.map((row) => [row.id, { name: row.name, organization: row.organization }])),
  )

/**
 * The Organizations the Account the request's Session proves belongs to, each with its Groups of its
 * own, by their ids and names, the earliest first: the Groups it may name in a Grant.
 */
export const groupsToShareWith = Effect.gen(function* () {
  const { account } = yield* sessionOnly
  const rows = yield* Organizations.use((organizations) => organizations.membershipsOf(account.id))
  return yield* Effect.forEach(rows, ({ organization }) =>
    Effect.map(
      Organizations.use((organizations) => organizations.groupsOf(organization)),
      (found) => ({ organization, groups: found.map(({ id, name }) => ({ id, name })) }),
    ),
  )
})

/**
 * That a Grant may name this Group for the Account the request's Session proves: a Group of an
 * Organization it is a member of, its Members Group or one of its own. `GroupNotFound` otherwise, a
 * deleted Group's included, so nobody names a Group they cannot see.
 */
export const shareableGroup = (group: string) =>
  Effect.gen(function* () {
    const { account } = yield* sessionOnly
    const rows = yield* Organizations.use((organizations) =>
      organizations.membershipsOf(account.id),
    )
    const named = yield* groupsNamed([group])
    const organization = named.get(group)?.organization ?? group
    if (!rows.some((row) => row.organization === organization)) return yield* new GroupNotFound()
  })
