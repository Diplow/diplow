// Organizations: a team that owns a System of its own, so its work belongs to no one member, and who
// belongs to it, each Account an admin or a member. IAM answers who belongs where and who is an
// admin, read on every request, never kept in a Session or a Turn; what an admin may do in the
// Organization's System is Mapping's, which counts them as its owner, as the API layer hands it
// (`belonging`). Creating one and managing its members take a Session (`sessionOnly`), never a Key
// nor a Turn's Key. An Organization keeps one admin at least: its last can neither leave, nor be
// removed, nor be made a member. Its name and Handle are its star's, Mapping's, which IAM never keeps.
import { Effect } from 'effect'

import {
  type MemberRow,
  Organizations,
} from '#/repositories/database/organizations/organizations'

import type { Role } from '../entities'
import {
  AccountNotFound,
  AdminRequired,
  AlreadyMember,
  LastAdmin,
  MemberNotFound,
  OrganizationNotFound,
} from '../errors'
import { sessionOnly } from '../iam'

/** A member of an Organization: the Account, by its id, and its role there. */
export interface Member {
  readonly account: string
  readonly role: Role
}

/**
 * The id of an Organization's Members Group, which holds every member, admins included, and is kept
 * by no one: the Organization's own id, so it needs no row, and Mapping, to whom both are opaque,
 * never sees it as the Organization's.
 */
export const membersGroupOf = (organization: string) => organization

/**
 * Who an Account stands for and belongs to, read now, never from a copy: the Organizations it is an
 * admin of, whose Systems it acts on as their owner, and the Groups it is in, the Members Group of
 * each Organization it belongs to. What the API layer hands Mapping on every request.
 */
export const belonging = (account: string) =>
  Effect.map(
    Organizations.use((organizations) => organizations.membershipsOf(account)),
    (rows) => ({
      admins: rows.flatMap(({ organization, role }) => (role === 'admin' ? [organization] : [])),
      groups: rows.map(({ organization }) => membersGroupOf(organization)),
    }),
  )

/** Whether this id is an Organization's, whose System's owner is no Account. */
export const isOrganization = (id: string) =>
  Organizations.use((organizations) => organizations.exists(id))

/**
 * Creates an Organization for the Account the request's Session proves, its first admin, and answers
 * its id, which owns the System whose star the API layer has Mapping make with it. Inside the
 * transaction the API layer opens around both.
 */
export const createOrganization = Effect.gen(function* () {
  const { account } = yield* sessionOnly
  const id = crypto.randomUUID()
  yield* Organizations.use((organizations) => organizations.create(id, account.id))
  return id
})

/** Its role in the Organization of the Account the request's Session proves, by its members. */
const roleIn = (members: ReadonlyArray<MemberRow>, account: string) =>
  members.find((member) => member.account === account)?.role

/**
 * The members of an Organization, the earliest first, read by one of them from a Session:
 * `OrganizationNotFound` for anyone else, as for an id no Organization has.
 */
export const members = (organization: string) =>
  Effect.gen(function* () {
    const { account } = yield* sessionOnly
    const found = yield* Organizations.use((organizations) => organizations.members(organization))
    if (roleIn(found, account.id) === undefined) return yield* new OrganizationNotFound()
    return found satisfies ReadonlyArray<Member>
  })

/**
 * The members of an Organization, its row locked until the transaction ends, once its admin acting
 * from a Session asks to change them: `OrganizationNotFound` for anyone not among them, and
 * `AdminRequired` for a member.
 */
const managedBy = (organization: string) =>
  Effect.gen(function* () {
    const { account } = yield* sessionOnly
    const found = yield* Organizations.use((organizations) => organizations.locked(organization))
    const role = roleIn(found, account.id)
    if (role === undefined) return yield* new OrganizationNotFound()
    if (role !== 'admin') return yield* new AdminRequired()
    return found
  })

/** The role of one member, by its Account, or `MemberNotFound`. */
const roleOf = (found: ReadonlyArray<MemberRow>, account: string) => {
  const role = roleIn(found, account)
  return role === undefined ? Effect.fail(new MemberNotFound()) : Effect.succeed(role)
}

/** Whether an Organization's members hold one admin alone, this Account. */
const lastAdmin = (found: ReadonlyArray<MemberRow>, account: string) =>
  found.every((member) => member.role !== 'admin' || member.account === account)

/**
 * Adds an Account to an Organization, a member, by one of its admins from a Session, without asking
 * first: `AccountNotFound` for an id no Account has, an Organization's included, and `AlreadyMember`
 * for one among its members. Inside a transaction.
 */
export const addMember = (organization: string, account: string) =>
  Effect.gen(function* () {
    yield* managedBy(organization)
    const isAccount = yield* Organizations.use((organizations) => organizations.isAccount(account))
    if (!isAccount) return yield* new AccountNotFound()
    const added = yield* Organizations.use((organizations) =>
      organizations.add(organization, { account, role: 'member' }),
    )
    if (!added) return yield* new AlreadyMember()
  })

/**
 * Makes a member an admin, or an admin a member, by one of its admins from a Session:
 * `MemberNotFound` for an Account not among its members, and `LastAdmin` for its last admin made a
 * member. Inside a transaction.
 */
export const setRole = (organization: string, account: string, role: Role) =>
  Effect.gen(function* () {
    const found = yield* managedBy(organization)
    const was = yield* roleOf(found, account)
    if (was === role) return
    if (role === 'member' && lastAdmin(found, account)) return yield* new LastAdmin()
    yield* Organizations.use((organizations) =>
      organizations.setRole(organization, { account, role }),
    )
  })

/**
 * Takes an Account out of an Organization, by one of its admins from a Session, themselves included:
 * `MemberNotFound` for an Account not among its members, and `LastAdmin` for its last admin. Holds
 * from the next request on, since nothing is kept of it. Inside a transaction.
 */
export const removeMember = (organization: string, account: string) =>
  Effect.gen(function* () {
    const found = yield* managedBy(organization)
    const role = yield* roleOf(found, account)
    if (role === 'admin' && lastAdmin(found, account)) return yield* new LastAdmin()
    yield* Organizations.use((organizations) => organizations.remove(organization, account))
  })
