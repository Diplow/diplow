// The `join_request` table (../schema.ts): an Account asking to join an Organization's Members, or a
// member one of its Groups (HEX-138), by an id IAM makes, open until an admin decides it. Part of
// IAM's Organizations repository (./organizations.ts), which merges these in: it speaks rows, and IAM
// decides who may ask, who decides, when a request is dropped, and that one at most is open per
// Account and Group, which the table's two partial keys hold behind it.
import { and, eq, inArray } from 'drizzle-orm'
import { Effect } from 'effect'

import { type Database, type InTransaction, inTransaction } from '../database'
import { joinRequest } from '../schema'

/** How a join request stands, as the table keeps it. */
type RequestState = 'open' | 'accepted' | 'declined'

/**
 * One join request: its id, the Organization, the Group asked for, none for its Members, the
 * Account that asked, how it stands, and when it was decided, none while it is open.
 */
export interface JoinRequestRow {
  readonly id: string
  readonly organization: string
  readonly group: string | undefined
  readonly account: string
  readonly state: RequestState
  readonly decidedAt: Date | undefined
}

/** The reads and writes of join requests. */
export interface JoinRows {
  /** The requests some ids name, in no order; none for an id of none. */
  readonly requestsNamed: (
    ids: ReadonlyArray<string>,
  ) => Effect.Effect<ReadonlyArray<JoinRequestRow>>
  /** The requests an Account made to an Organization, open or decided, in no order. */
  readonly requestsBy: (
    account: string,
    organization: string,
  ) => Effect.Effect<ReadonlyArray<JoinRequestRow>>
  /** Adds an open request under this id. Inside a transaction. */
  readonly addRequest: (
    request: Omit<JoinRequestRow, 'state' | 'decidedAt'>,
  ) => Effect.Effect<void, never, InTransaction>
  /** Sets how an open request was decided, and when. Inside a transaction. */
  readonly decideRequest: (
    id: string,
    decided: { readonly state: Exclude<RequestState, 'open'>; readonly at: Date },
  ) => Effect.Effect<void, never, InTransaction>
  /** Deletes the requests an Account has open to an Organization. Inside a transaction. */
  readonly dropOpenRequests: (
    organization: string,
    account: string,
  ) => Effect.Effect<void, never, InTransaction>
}

/** A row as the table keeps it, its Group null for the Members. */
const columns = {
  id: joinRequest.id,
  organization: joinRequest.organizationId,
  group: joinRequest.groupId,
  account: joinRequest.accountId,
  state: joinRequest.state,
  decidedAt: joinRequest.decidedAt,
}

const rowOf = ({
  group,
  decidedAt,
  ...row
}: { group: string | null; decidedAt: Date | null } & Omit<
  JoinRequestRow,
  'group' | 'decidedAt'
>): JoinRequestRow => ({ ...row, group: group ?? undefined, decidedAt: decidedAt ?? undefined })

export const joinRowsOf = (database: Database['Service']): JoinRows => ({
  requestsNamed: (ids) =>
    ids.length === 0
      ? Effect.succeed([])
      : database
          .select(columns)
          .from(joinRequest)
          .where(inArray(joinRequest.id, [...ids]))
          .pipe(
            Effect.orDie,
            Effect.map((rows) => rows.map(rowOf)),
          ),
  requestsBy: (account, organization) =>
    database
      .select(columns)
      .from(joinRequest)
      .where(and(eq(joinRequest.accountId, account), eq(joinRequest.organizationId, organization)))
      .pipe(
        Effect.orDie,
        Effect.map((rows) => rows.map(rowOf)),
      ),
  addRequest: ({ id, organization, group, account }) =>
    inTransaction(
      database
        .insert(joinRequest)
        .values({ id, organizationId: organization, groupId: group ?? null, accountId: account })
        .pipe(Effect.orDie, Effect.asVoid),
    ),
  decideRequest: (id, { state, at }) =>
    inTransaction(
      database
        .update(joinRequest)
        .set({ state, decidedAt: at })
        .where(and(eq(joinRequest.id, id), eq(joinRequest.state, 'open')))
        .pipe(Effect.orDie, Effect.asVoid),
    ),
  dropOpenRequests: (organization, account) =>
    inTransaction(
      database
        .delete(joinRequest)
        .where(
          and(
            eq(joinRequest.organizationId, organization),
            eq(joinRequest.accountId, account),
            eq(joinRequest.state, 'open'),
          ),
        )
        .pipe(Effect.orDie, Effect.asVoid),
    ),
})
