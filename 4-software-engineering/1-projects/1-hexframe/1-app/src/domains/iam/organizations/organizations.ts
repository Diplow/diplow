// Organizations: a team that owns a System of its own, so its work belongs to no one member, and who
// belongs to it, each Account an admin or a member. IAM answers who belongs where and who is an
// admin, read on every request, never kept in a Session or a Turn; what an admin may do in the
// Organization's System is Mapping's, which counts them as its owner, as the API layer hands it
// (`belonging`). Creating one and managing its members take a Session (`sessionOnly`), never a Key
// nor a Turn's Key. An Organization keeps one admin at least who joined it of their own accord, as
// its maker did: that last can neither leave, nor be removed, nor be made a member, while someone an
// admin added without asking, and made an admin, may always be taken out, themselves leaving
// included, so nobody is left holding an Organization they never chose. Its name and Handle are its
// star's, Mapping's, which IAM never keeps. Someone added, or taken out, is a fact on the bus
// (`MemberAdded`, `MemberRemoved`), which the API layer tells in their timeline (HEX-138).
import { Effect, Schema } from 'effect'

import { Bus } from '#/domains/bus'

import { type MemberRow, Organizations } from '#/repositories/database/organizations/organizations'

import type { Role, Standing } from '../entities'
import {
  AccountNotFound,
  AdminRequired,
  AlreadyMember,
  LastAdmin,
  MemberNotFound,
  OrganizationNotFound,
} from '../errors'
import { sessionOnly } from '../iam'

/**
 * An Account added to an Organization by one of its admins, without asking first: published once the
 * transaction commits. It says nothing of who added it, which the bus's envelope carries.
 */
export class MemberAdded extends Schema.TaggedClass<MemberAdded>()('MemberAdded', {
  organization: Schema.String,
  account: Schema.String,
}) {}

/**
 * An Account taken out of an Organization, by one of its admins or by itself, leaving: published once
 * the transaction commits. Who took it out rides on the bus's envelope.
 */
export class MemberRemoved extends Schema.TaggedClass<MemberRemoved>()('MemberRemoved', {
  organization: Schema.String,
  account: Schema.String,
}) {}

/**
 * The id of an Organization's Members Group, which holds every member, admins included, and is kept
 * by no one: the Organization's own id, so it needs no row, and Mapping, to whom both are opaque,
 * never sees it as the Organization's.
 */
export const membersGroupOf = (organization: string) => organization

/**
 * Who an Account stands for and belongs to, read now, never from a copy: the Organizations it is an
 * admin of, whose Systems it acts on as their owner, and the Groups it is in, the Members Group of
 * each Organization it belongs to and each Group of an Organization's own it was put in (HEX-137). A
 * deleted Group is in no answer, so its Grants resolve for nobody from the next request on. What the
 * API layer hands Mapping on every request.
 */
export const belonging = (account: string) =>
  Effect.map(
    Organizations.use((organizations) =>
      Effect.all([organizations.membershipsOf(account), organizations.groupsIn(account)], {
        concurrency: 'unbounded',
      }),
    ),
    ([rows, groups]) => ({
      admins: rows.flatMap(({ organization, role }) => (role === 'admin' ? [organization] : [])),
      groups: [...rows.map(({ organization }) => membersGroupOf(organization)), ...groups],
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

/** The role an Account holds among an Organization's members, none when it is not among them. */
export const roleIn = (members: ReadonlyArray<MemberRow>, account: string) =>
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
    return found
  })

/**
 * Where the Account the request's Session proves stands in an Organization, read now: its role among
 * its members, or `outside` it, where it may ask to join.
 */
export const standingIn = (organization: string) =>
  Effect.gen(function* () {
    const { account } = yield* sessionOnly
    const found = yield* Organizations.use((organizations) => organizations.members(organization))
    const standing: Standing = roleIn(found, account.id) ?? 'outside'
    return standing
  })

/**
 * The members of an Organization, its row locked until the transaction ends, once its admin acting
 * from a Session asks to change them: `OrganizationNotFound` for anyone not among them, and
 * `AdminRequired` for a member.
 */
export const managedBy = (organization: string) =>
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

/**
 * Whether this Account is the Organization's last admin who joined of their own accord: taking it
 * out, or making it a member, would leave the Organization to admins who never chose it, or none.
 * An admin added without asking is never that one, so they may always leave.
 */
const lastJoinedAdmin = (found: ReadonlyArray<MemberRow>, account: string) => {
  const holds = (member: MemberRow) => member.role === 'admin' && member.joined
  return (
    found.some((member) => member.account === account && holds(member)) &&
    !found.some((member) => member.account !== account && holds(member))
  )
}

/**
 * Adds an Account to an Organization, a member, by one of its admins from a Session, without asking
 * first: `AccountNotFound` for an id no Account has, an Organization's included, and `AlreadyMember`
 * for one among its members. A request of theirs to join it, open, has nothing left to decide and
 * goes. Publishes `MemberAdded`, so they are told. Inside a transaction.
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
    yield* Organizations.use((organizations) =>
      organizations.dropOpenRequests(organization, account),
    )
    const { publish } = yield* Bus
    yield* publish(new MemberAdded({ organization, account }))
  })

/**
 * Makes a member an admin, or an admin a member, by one of its admins from a Session:
 * `MemberNotFound` for an Account not among its members, and `LastAdmin` for its last admin who
 * joined made a member (`lastJoinedAdmin`). Inside a transaction.
 */
export const setRole = (organization: string, account: string, role: Role) =>
  Effect.gen(function* () {
    const found = yield* managedBy(organization)
    const was = yield* roleOf(found, account)
    if (was === role) return
    if (role === 'member' && lastJoinedAdmin(found, account)) return yield* new LastAdmin()
    yield* Organizations.use((organizations) =>
      organizations.setRole(organization, { account, role }),
    )
  })

/**
 * The members of an Organization, its row locked until the transaction ends, once the Account the
 * request's Session proves asks to take this one out: themselves, whatever their role, so anyone
 * added without asking may leave; anyone else as `managedBy` lets an admin.
 */
const leftBy = (organization: string, account: string) =>
  Effect.gen(function* () {
    const { account: asking } = yield* sessionOnly
    if (asking.id !== account) return yield* managedBy(organization)
    const found = yield* Organizations.use((organizations) => organizations.locked(organization))
    if (roleIn(found, account) === undefined) return yield* new OrganizationNotFound()
    return found
  })

/**
 * Takes an Account out of an Organization, from a Session: by one of its admins, or by the Account
 * itself, leaving, whatever its role, so nobody stays in one they never chose. `MemberNotFound` for
 * an Account not among its members, and `LastAdmin` for its last admin who joined
 * (`lastJoinedAdmin`). Holds from the next request on, since nothing is kept of it. Its open
 * requests to join the Organization or its Groups go with it, so no old one brings it back. Publishes `MemberRemoved`, so someone taken
 * out by an admin is told. Inside a transaction.
 */
export const removeMember = (organization: string, account: string) =>
  Effect.gen(function* () {
    const found = yield* leftBy(organization, account)
    const role = yield* roleOf(found, account)
    if (role === 'admin' && lastJoinedAdmin(found, account)) return yield* new LastAdmin()
    yield* Organizations.use((organizations) => organizations.remove(organization, account))
    yield* Organizations.use((organizations) =>
      organizations.dropOpenRequests(organization, account),
    )
    const { publish } = yield* Bus
    yield* publish(new MemberRemoved({ organization, account }))
  })
