// IAM's Organizations: the `organization` and `membership` tables (../schema.ts), which Better Auth
// does not keep. An Organization is its id alone, its name being its star's Title in Mapping; who
// belongs to it is a membership per Account, an admin or a member; and its Groups of its own, with who
// is in each (./groups.ts, merged in here). IAM decides what a role lets someone do, and that an
// Organization keeps an admin; this folder reads and writes the rows.
import { and, asc, eq } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'

import { Database, InTransaction, inTransaction } from '../database'
import { membership, organization, user } from '../schema'
import { type GroupRows, groupRowsOf } from './groups'

/** A role in an Organization, as the `membership` table keeps it. */
type MemberRole = 'admin' | 'member'

/** One Organization an Account belongs to, by its id, and the role the Account holds there. */
export interface MembershipRow {
  readonly organization: string
  readonly role: MemberRole
}

/**
 * One member of an Organization: the Account, by its id, its role, and whether it joined of its own
 * accord, as the Organization's maker did, rather than being added without asking.
 */
export interface MemberRow {
  readonly account: string
  readonly role: MemberRole
  readonly joined: boolean
}

export class Organizations extends Context.Service<
  Organizations,
  GroupRows & {
    /**
     * Adds an Organization of this id, its first member this Account, an admin who joined. Inside a
     * transaction.
     */
    readonly create: (
      organization: string,
      admin: string,
    ) => Effect.Effect<void, never, InTransaction>
    /** Whether an Organization has this id. */
    readonly exists: (organization: string) => Effect.Effect<boolean>
    /** Whether an Account has this id. */
    readonly isAccount: (account: string) => Effect.Effect<boolean>
    /** The Organizations an Account belongs to, each with its role there, in no order. */
    readonly membershipsOf: (account: string) => Effect.Effect<ReadonlyArray<MembershipRow>>
    /**
     * The members of an Organization, the earliest first, none for an id no Organization has, the
     * Organization's row locked until the transaction ends when asked inside one (`locked`), so two
     * changes of its members decide one after the other.
     */
    readonly members: (organization: string) => Effect.Effect<ReadonlyArray<MemberRow>>
    readonly locked: (
      organization: string,
    ) => Effect.Effect<ReadonlyArray<MemberRow>, never, InTransaction>
    /**
     * Adds an Account to an Organization with a role, as no member who joined, answering false when
     * it was one already.
     */
    readonly add: (
      organization: string,
      member: Omit<MemberRow, 'joined'>,
    ) => Effect.Effect<boolean, never, InTransaction>
    /** Sets a member's role. Inside a transaction. */
    readonly setRole: (
      organization: string,
      member: Omit<MemberRow, 'joined'>,
    ) => Effect.Effect<void, never, InTransaction>
    /** Takes an Account out of an Organization. Inside a transaction. */
    readonly remove: (
      organization: string,
      account: string,
    ) => Effect.Effect<void, never, InTransaction>
  }
>()('hexframe/Organizations') {}

const make = Effect.gen(function* () {
  const database = yield* Database

  const membersOf = (id: string) =>
    database
      .select({ account: membership.accountId, role: membership.role, joined: membership.joined })
      .from(membership)
      .where(eq(membership.organizationId, id))
      .orderBy(asc(membership.createdAt), asc(membership.accountId))
      .pipe(Effect.orDie)

  const lockRow = (id: string) =>
    database
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.id, id))
      .for('update')
      .pipe(Effect.orDie)

  const ofOne = (id: string, account: string) =>
    and(eq(membership.organizationId, id), eq(membership.accountId, account))

  return Organizations.of({
    ...groupRowsOf(database),
    create: (id, admin) =>
      inTransaction(
        Effect.gen(function* () {
          yield* database.insert(organization).values({ id }).pipe(Effect.orDie)
          yield* database
            .insert(membership)
            .values({ organizationId: id, accountId: admin, role: 'admin', joined: true })
            .pipe(Effect.orDie)
        }),
      ),
    exists: (id) =>
      database
        .select({ id: organization.id })
        .from(organization)
        .where(eq(organization.id, id))
        .pipe(
          Effect.orDie,
          Effect.map((found) => found.length > 0),
        ),
    isAccount: (account) =>
      database
        .select({ id: user.id })
        .from(user)
        .where(eq(user.id, account))
        .pipe(
          Effect.orDie,
          Effect.map((found) => found.length > 0),
        ),
    membershipsOf: (account) =>
      database
        .select({ organization: membership.organizationId, role: membership.role })
        .from(membership)
        .where(eq(membership.accountId, account))
        .pipe(Effect.orDie),
    members: membersOf,
    locked: (id) =>
      inTransaction(
        Effect.flatMap(lockRow(id), (found) =>
          found.length === 0 ? Effect.succeed([]) : membersOf(id),
        ),
      ),
    add: (id, { account, role }) =>
      inTransaction(
        database
          .insert(membership)
          .values({ organizationId: id, accountId: account, role })
          .onConflictDoNothing()
          .returning({ account: membership.accountId })
          .pipe(
            Effect.orDie,
            Effect.map((added) => added.length > 0),
          ),
      ),
    setRole: (id, { account, role }) =>
      inTransaction(
        database
          .update(membership)
          .set({ role })
          .where(ofOne(id, account))
          .pipe(Effect.orDie, Effect.asVoid),
      ),
    remove: (id, account) =>
      inTransaction(
        database.delete(membership).where(ofOne(id, account)).pipe(Effect.orDie, Effect.asVoid),
      ),
  })
})

/** The Organizations repository, over the `Database` it is given. */
export const layer = Layer.effect(Organizations)(make)
