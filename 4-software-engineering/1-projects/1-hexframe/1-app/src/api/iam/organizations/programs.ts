// The programs behind the Organizations' server functions (./organizations.ts): an Organization made
// with its System, the Account its first admin, and its members read and changed by its admins, each
// from a Session alone (IAM's `sessionOnly`), never a Key nor a Turn's Key. IAM keeps who belongs
// where, Mapping the System and its star, which names the Organization: the browser names an
// Organization and each of its members by their stars, never by an id of IAM's. In a module of their
// own since they reach the domains and the database, which Start strips from the client.
import { Effect } from 'effect'

import type { Role } from '#/domains/iam/entities'
import { OrganizationNotFound } from '#/domains/iam/errors'
import * as Iam from '#/domains/iam/iam'
import * as Organizations from '#/domains/iam/organizations/organizations'
import type { StarCard } from '#/domains/mapping/entities'
import * as Mapping from '#/domains/mapping/mapping'
import * as Stars from '#/domains/mapping/sharing/stars'
import { transactional } from '#/repositories/database/database'

/**
 * Creates an Organization for the Account the request's Session proves, its first admin, and its
 * System, whose star is born with the name given, trimmed (`TitleMissing` for a blank one), in one
 * transaction: answers that star, the Organization's Handle, which its System is visited by.
 */
export const createOrganization = ({ name }: { readonly name: string }) =>
  Effect.andThen(
    Iam.sessionOnly,
    transactional(
      Effect.gen(function* () {
        const organization = yield* Organizations.createOrganization
        return { star: yield* Stars.starNamed(organization, name) }
      }),
    ),
  )

/**
 * The Organization a star names, by its id, once the request's Session is proven:
 * `OrganizationNotFound` for a star of an Account's System, or one that names nothing, which IAM
 * then answers the same for a member and a stranger alike.
 */
const organizationAt = (star: string) =>
  Effect.andThen(
    Iam.sessionOnly,
    Mapping.ownerOf(star).pipe(
      Effect.catchTag('TileNotFound', () => Effect.fail(new OrganizationNotFound())),
      Effect.flatMap((owner) =>
        Effect.flatMap(Organizations.isOrganization(owner), (is) =>
          is ? Effect.succeed(owner) : Effect.fail(new OrganizationNotFound()),
        ),
      ),
    ),
  )

/**
 * The Account a member's star names, by its id, `''` for a star that names none, which no Account
 * nor member has: IAM then refuses it after it found the request is an admin's, so a stranger
 * learns nothing of a member's star (`AccountNotFound`, `MemberNotFound`) before
 * `OrganizationNotFound`. Whether it is an Account at all, rather than an Organization, is IAM's to
 * say.
 */
const accountAt = (star: string) =>
  Effect.catchTag(Mapping.ownerOf(star), 'TileNotFound', () => Effect.succeed(''))

/**
 * The role of the Account the request's Session proves in the Organization a star names, none when
 * the star names no Organization or the Account is not among its members: what tells the page that a
 * star's menu offers its Members widget. Read now, never kept.
 */
export const roleIn = ({ star }: { readonly star: string }) =>
  Effect.gen(function* () {
    const { account } = yield* Iam.sessionOnly
    const found = yield* organizationAt(star).pipe(
      Effect.flatMap(Organizations.members),
      Effect.catchTag('OrganizationNotFound', () => Effect.succeed([])),
    )
    const role: Role | null = found.find((member) => member.account === account.id)?.role ?? null
    return role
  })

/** One member of an Organization as the Members widget shows them: by their star, and their role. */
export interface MemberShown {
  /** Their star's card, none while they have no System yet. */
  readonly star: StarCard | undefined
  readonly role: Role
  /** Whether it is the Account reading the list. */
  readonly you: boolean
}

/**
 * The members of the Organization a star names, the earliest first, each by their star's card and
 * their role, read by one of them from a Session: `OrganizationNotFound` for anyone else.
 */
export const members = ({ star }: { readonly star: string }) =>
  Effect.gen(function* () {
    const { account } = yield* Iam.sessionOnly
    const organization = yield* organizationAt(star)
    const found = yield* Organizations.members(organization)
    const stars = yield* Stars.starsOf(found.map((member) => member.account))
    return found.map((member): MemberShown => ({
      star: stars.get(member.account),
      role: member.role,
      you: member.account === account.id,
    }))
  })

/**
 * Adds the Account a star names to the Organization another names, a member, by one of its admins
 * from a Session, in one transaction: `AccountNotFound` for a star that names no Account, an
 * Organization's included, and `AlreadyMember` for one among its members.
 */
export const addMember = ({ star, member }: { readonly star: string; readonly member: string }) =>
  Effect.gen(function* () {
    const organization = yield* organizationAt(star)
    const account = yield* accountAt(member)
    yield* transactional(Organizations.addMember(organization, account))
    return null
  })

/**
 * Makes a member, named by their star, an admin or a member, by one of its admins from a Session, in
 * one transaction: `MemberNotFound` for a star of no member, and `LastAdmin` for its last admin.
 */
export const setMemberRole = ({
  star,
  member,
  role,
}: {
  readonly star: string
  readonly member: string
  readonly role: Role
}) =>
  Effect.gen(function* () {
    const organization = yield* organizationAt(star)
    const account = yield* accountAt(member)
    yield* transactional(Organizations.setRole(organization, account, role))
    return null
  })

/**
 * Takes a member, named by their star, out of the Organization, by one of its admins from a Session,
 * themselves included, in one transaction: `MemberNotFound` for a star of no member, and `LastAdmin`
 * for its last admin. Holds from their next request on.
 */
export const removeMember = ({
  star,
  member,
}: {
  readonly star: string
  readonly member: string
}) =>
  Effect.gen(function* () {
    const organization = yield* organizationAt(star)
    const account = yield* accountAt(member)
    yield* transactional(Organizations.removeMember(organization, account))
    return null
  })
