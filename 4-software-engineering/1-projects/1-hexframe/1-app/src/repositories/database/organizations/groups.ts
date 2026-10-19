// The `organization_group` and `group_member` tables (../schema.ts): an Organization's Groups of its
// own, beside its Members Group, which needs no row, each by its id and its name, and who is in each,
// always among the Organization's members, which the table's key to `membership` holds. Part of IAM's
// Organizations repository (./organizations.ts), which merges these in: it speaks rows, and IAM
// decides who may change them, its admins from a Session, and what a name must be.
import { and, asc, eq, inArray } from 'drizzle-orm'
import { Effect } from 'effect'

import { type Database, type InTransaction, inTransaction } from '../database'
import { groupMember, organizationGroup } from '../schema'

/** One Group of an Organization's own: its id, its name, and its members' Accounts, earliest first. */
interface GroupRow {
  readonly id: string
  readonly name: string
  readonly members: ReadonlyArray<string>
}

/** A Group by its id, with its name and the Organization it belongs to. */
interface GroupOfRow {
  readonly id: string
  readonly name: string
  readonly organization: string
}

/** The reads and writes of an Organization's Groups. */
export interface GroupRows {
  /** The Groups of an Organization, the earliest first, each with its members. */
  readonly groupsOf: (organization: string) => Effect.Effect<ReadonlyArray<GroupRow>>
  /** The Groups some ids name, each with its name and its Organization; none for an id of none. */
  readonly groupsNamed: (ids: ReadonlyArray<string>) => Effect.Effect<ReadonlyArray<GroupOfRow>>
  /** The Groups of some Organizations, the earliest first, each with its name and Organization. */
  readonly groupsAmong: (
    organizations: ReadonlyArray<string>,
  ) => Effect.Effect<ReadonlyArray<GroupOfRow>>
  /** The ids of the Groups an Account is in, in no order. */
  readonly groupsIn: (account: string) => Effect.Effect<ReadonlyArray<string>>
  /** Adds a Group to an Organization under this id and name. Inside a transaction. */
  readonly addGroup: (
    organization: string,
    group: Omit<GroupRow, 'members'>,
  ) => Effect.Effect<void, never, InTransaction>
  /** Renames one of an Organization's Groups. Inside a transaction. */
  readonly renameGroup: (
    organization: string,
    group: Omit<GroupRow, 'members'>,
  ) => Effect.Effect<void, never, InTransaction>
  /** Deletes one of an Organization's Groups, who was in it with it. Inside a transaction. */
  readonly removeGroup: (
    organization: string,
    group: string,
  ) => Effect.Effect<void, never, InTransaction>
  /**
   * Puts one of an Organization's members in one of its Groups, nothing when there already. Inside a
   * transaction.
   */
  readonly addToGroup: (
    organization: string,
    member: { readonly group: string; readonly account: string },
  ) => Effect.Effect<void, never, InTransaction>
  /** Takes an Account out of one of an Organization's Groups. Inside a transaction. */
  readonly removeFromGroup: (
    organization: string,
    member: { readonly group: string; readonly account: string },
  ) => Effect.Effect<void, never, InTransaction>
}

export const groupRowsOf = (database: Database['Service']): GroupRows => {
  const ofOne = (organization: string, group: string) =>
    and(eq(organizationGroup.organizationId, organization), eq(organizationGroup.id, group))

  const inOne = (organization: string, { group, account }: { group: string; account: string }) =>
    and(
      eq(groupMember.organizationId, organization),
      eq(groupMember.groupId, group),
      eq(groupMember.accountId, account),
    )

  return {
    groupsOf: (organization) =>
      Effect.gen(function* () {
        const groups = yield* database
          .select({ id: organizationGroup.id, name: organizationGroup.name })
          .from(organizationGroup)
          .where(eq(organizationGroup.organizationId, organization))
          .orderBy(asc(organizationGroup.createdAt), asc(organizationGroup.id))
          .pipe(Effect.orDie)
        const members = yield* database
          .select({ group: groupMember.groupId, account: groupMember.accountId })
          .from(groupMember)
          .where(eq(groupMember.organizationId, organization))
          .orderBy(asc(groupMember.createdAt), asc(groupMember.accountId))
          .pipe(Effect.orDie)
        return groups.map((group) => ({
          ...group,
          members: members.flatMap((member) => (member.group === group.id ? [member.account] : [])),
        }))
      }),
    groupsNamed: (ids) =>
      ids.length === 0
        ? Effect.succeed([])
        : database
            .select({
              id: organizationGroup.id,
              name: organizationGroup.name,
              organization: organizationGroup.organizationId,
            })
            .from(organizationGroup)
            .where(inArray(organizationGroup.id, [...ids]))
            .pipe(Effect.orDie),
    groupsAmong: (organizations) =>
      organizations.length === 0
        ? Effect.succeed([])
        : database
            .select({
              id: organizationGroup.id,
              name: organizationGroup.name,
              organization: organizationGroup.organizationId,
            })
            .from(organizationGroup)
            .where(inArray(organizationGroup.organizationId, [...organizations]))
            .orderBy(asc(organizationGroup.createdAt), asc(organizationGroup.id))
            .pipe(Effect.orDie),
    groupsIn: (account) =>
      database
        .select({ group: groupMember.groupId })
        .from(groupMember)
        .where(eq(groupMember.accountId, account))
        .pipe(
          Effect.orDie,
          Effect.map((rows) => rows.map(({ group }) => group)),
        ),
    addGroup: (organization, { id, name }) =>
      inTransaction(
        database
          .insert(organizationGroup)
          .values({ id, organizationId: organization, name })
          .pipe(Effect.orDie, Effect.asVoid),
      ),
    renameGroup: (organization, { id, name }) =>
      inTransaction(
        database
          .update(organizationGroup)
          .set({ name })
          .where(ofOne(organization, id))
          .pipe(Effect.orDie, Effect.asVoid),
      ),
    removeGroup: (organization, group) =>
      inTransaction(
        database
          .delete(organizationGroup)
          .where(ofOne(organization, group))
          .pipe(Effect.orDie, Effect.asVoid),
      ),
    addToGroup: (organization, { group, account }) =>
      inTransaction(
        database
          .insert(groupMember)
          .values({ groupId: group, organizationId: organization, accountId: account })
          .onConflictDoNothing()
          .pipe(Effect.orDie, Effect.asVoid),
      ),
    removeFromGroup: (organization, member) =>
      inTransaction(
        database
          .delete(groupMember)
          .where(inOne(organization, member))
          .pipe(Effect.orDie, Effect.asVoid),
      ),
  }
}
