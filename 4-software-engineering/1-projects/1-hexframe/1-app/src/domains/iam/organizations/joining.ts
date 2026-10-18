// Joining an Organization of one's own accord (HEX-138): any Account asks to join its Members, from
// its star, and a member asks to join one of its Groups, which it sees; the request waits until one
// of its admins accepts or declines it, from a Session, and at most one is open per Account and
// Group, held under the Organization's row's lock. Accepted, the Account is a member who joined, as
// the Organization's maker did, or in the Group; declined, nothing changes. Each is a fact on the
// bus (`JoinAsked`, `JoinDecided`), which the API layer tells: a request in every admin's timeline,
// its outcome in the timeline of whoever asked. Asking and deciding take a Session (`sessionOnly`),
// never a Key nor a Turn's Key.
import { Clock, Effect, Schema } from 'effect'

import { Bus } from '#/domains/bus'
import { Organizations } from '#/repositories/database/organizations/organizations'

import type { GroupStanding, JoinState, Standing } from '../entities'
import {
  AlreadyInGroup,
  AlreadyMember,
  GroupNotFound,
  JoinRequestDeclined,
  JoinRequestDecided,
  JoinRequestNotFound,
  JoinRequestOpen,
  OrganizationNotFound,
} from '../errors'
import { sessionOnly } from '../iam'
import { managedBy, roleIn } from './organizations'

/**
 * An Account asked to join an Organization's Members, or one of its Groups (`group`, none for the
 * Members), by its request's id: published once the transaction commits, for its admins to be told.
 */
export class JoinAsked extends Schema.TaggedClass<JoinAsked>()('JoinAsked', {
  request: Schema.String,
  organization: Schema.String,
  group: Schema.optionalKey(Schema.String),
  account: Schema.String,
}) {}

/**
 * A request to join decided by one of the Organization's admins, accepted or declined: published once
 * the transaction commits, for whoever asked to be told. Who decided rides on the bus's envelope.
 */
export class JoinDecided extends Schema.TaggedClass<JoinDecided>()('JoinDecided', {
  request: Schema.String,
  organization: Schema.String,
  group: Schema.optionalKey(Schema.String),
  account: Schema.String,
  accepted: Schema.Boolean,
}) {}

/**
 * That the asking Account may ask to join this, among an Organization's members as found: its
 * Members, for anyone who is not one of them (`AlreadyMember`); one of its Groups, for a member who
 * is not in it (`AlreadyInGroup`), `GroupNotFound` for anyone else, since a Group is its members' to
 * see, and for an id none of its Groups has.
 */
const mayAsk = (organization: string, account: string, group: string | undefined) =>
  Effect.gen(function* () {
    const found = yield* Organizations.use((organizations) => organizations.locked(organization))
    if (found.length === 0) return yield* new OrganizationNotFound()
    const member = roleIn(found, account) !== undefined
    if (group === undefined) return member ? yield* new AlreadyMember() : undefined
    if (!member) return yield* new GroupNotFound()
    const groups = yield* Organizations.use((organizations) => organizations.groupsOf(organization))
    const asked = groups.find((one) => one.id === group)
    if (asked === undefined) return yield* new GroupNotFound()
    if (asked.members.includes(account)) return yield* new AlreadyInGroup()
  })

/** How long after a decline an Account may ask for the same again, in milliseconds: a day. */
const askAgainAfter = 24 * 60 * 60_000

/** A request to join as the rules read it: what it asks for, how it stands, and when it was decided. */
interface Asked {
  readonly group: string | undefined
  readonly state: JoinState
  readonly decidedAt: Date | undefined
}

/**
 * Why an Account may not ask for this again now, by its requests to the Organization so far: one for
 * the same still `open`, or one an admin `declined` within a day, so a declined Account cannot fill
 * every admin's timeline, and their agent's prompt, with a request at each click; none when it may.
 * Pure: asking, where an Account stands and its Groups read it alike.
 */
export function askedAlready(
  requests: ReadonlyArray<Asked>,
  group: string | undefined,
  now: number,
): 'open' | 'declined' | undefined {
  const same = requests.filter((one) => one.group === group)
  if (same.some((one) => one.state === 'open')) return 'open'
  const lately = (one: Asked) =>
    one.state === 'declined' &&
    one.decidedAt !== undefined &&
    now - one.decidedAt.getTime() < askAgainAfter
  return same.some(lately) ? 'declined' : undefined
}

/** An Account's requests to an Organization, and the instant now, which `askedAlready` reads. */
const askedSoFar = (account: string, organization: string) =>
  Effect.all([
    Organizations.use((organizations) => organizations.requestsBy(account, organization)),
    Clock.currentTimeMillis,
  ])

/** That the Account may ask for this again now: `JoinRequestOpen` or `JoinRequestDeclined` otherwise. */
const mayAskAgain = (organization: string, account: string, group: string | undefined) =>
  Effect.gen(function* () {
    const [requests, now] = yield* askedSoFar(account, organization)
    const already = askedAlready(requests, group, now)
    if (already === 'open') return yield* new JoinRequestOpen()
    if (already === 'declined') return yield* new JoinRequestDeclined()
  })

/**
 * Asks, for the Account the request's Session proves, to join an Organization's Members, or one of
 * its Groups, and answers the request's id: `OrganizationNotFound` for an id no Organization has,
 * refused as `mayAsk` and `mayAskAgain` say, decided under the Organization's row's lock. Publishes
 * `JoinAsked`. Inside a transaction.
 */
export const askToJoin = (organization: string, group?: string) =>
  Effect.gen(function* () {
    const { account } = yield* sessionOnly
    yield* mayAsk(organization, account.id, group)
    yield* mayAskAgain(organization, account.id, group)
    const id = crypto.randomUUID()
    const asked = { organization, ...(group !== undefined && { group }), account: account.id }
    yield* Organizations.use((organizations) => organizations.addRequest({ id, group, ...asked }))
    const { publish } = yield* Bus
    yield* publish(new JoinAsked({ request: id, ...asked }))
    return id
  })

/** One request to join by its id, or `JoinRequestNotFound`. */
const requestOf = (request: string) =>
  Effect.flatMap(
    Organizations.use((organizations) => organizations.requestsNamed([request])),
    ([found]) =>
      found === undefined ? Effect.fail(new JoinRequestNotFound()) : Effect.succeed(found),
  )

/**
 * Accepts or declines a request to join, by one of its Organization's admins from a Session, the
 * Organization's row locked: accepted, the Account who asked becomes a member who joined of its own
 * accord, or is put in the Group, nothing changing where it already is; declined, nothing changes.
 * `JoinRequestNotFound` for an id no request has, and for anyone but an admin of its Organization,
 * so a request is its admins' alone to know of; `JoinRequestDecided` once decided already. Publishes
 * `JoinDecided`. Inside a transaction.
 */
export const decideJoinRequest = (request: string, accept: boolean) =>
  Effect.gen(function* () {
    yield* sessionOnly
    const { organization } = yield* requestOf(request)
    yield* managedBy(organization).pipe(
      Effect.catchTags({
        OrganizationNotFound: () => Effect.fail(new JoinRequestNotFound()),
        AdminRequired: () => Effect.fail(new JoinRequestNotFound()),
      }),
    )
    // Read again under the lock, so two admins deciding at once decide one after the other.
    const { group, account, state } = yield* requestOf(request)
    if (state !== 'open') return yield* new JoinRequestDecided()
    // A Group's request is a member's, and leaving drops it: `group_member`'s key holds that too.
    if (accept) {
      yield* Organizations.use((organizations) =>
        group === undefined
          ? organizations.join(organization, account)
          : organizations.addToGroup(organization, { group, account }),
      )
    }
    const at = new Date(yield* Clock.currentTimeMillis)
    yield* Organizations.use((organizations) =>
      organizations.decideRequest(request, { state: accept ? 'accepted' : 'declined', at }),
    )
    const { publish } = yield* Bus
    yield* publish(
      new JoinDecided({
        request,
        organization,
        ...(group !== undefined && { group }),
        account,
        accepted: accept,
      }),
    )
  })

/**
 * How some requests to join stand, by their ids, as the Account the request's Session proves may
 * know: those of the Organizations it is an admin of now, read now; any other left out, an id no
 * request has included. What the admins' timelines show a request by.
 */
export const requestsSeen = (ids: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const { account } = yield* sessionOnly
    const rows = yield* Organizations.use((organizations) =>
      organizations.membershipsOf(account.id),
    )
    const theirs = new Set(rows.flatMap((row) => (row.role === 'admin' ? [row.organization] : [])))
    const found = yield* Organizations.use((organizations) => organizations.requestsNamed(ids))
    return new Map(
      found.flatMap((row): ReadonlyArray<readonly [string, JoinState]> =>
        theirs.has(row.organization) ? [[row.id, row.state]] : [],
      ),
    )
  })

/**
 * Where the Account the request's Session proves stands in an Organization, read now: its role among
 * its members; `outside` it, where it may ask to join; or having `asked`, its request open or
 * declined lately (`askedAlready`).
 */
export const standingIn = (organization: string) =>
  Effect.gen(function* () {
    const { account } = yield* sessionOnly
    const found = yield* Organizations.use((organizations) => organizations.members(organization))
    const role = roleIn(found, account.id)
    if (role !== undefined) return role satisfies Standing
    const [requests, now] = yield* askedSoFar(account.id, organization)
    const standing: Standing =
      askedAlready(requests, undefined, now) === undefined ? 'outside' : 'asked'
    return standing
  })

/**
 * Where an Account stands toward each of some Groups of an Organization, read now: `in` it, may `ask`
 * to join it, or has `asked` (`askedAlready`). What the Groups widget offers each by.
 */
export const groupStandings = (
  account: string,
  organization: string,
  groups: ReadonlyArray<{ readonly id: string; readonly members: ReadonlyArray<string> }>,
) =>
  Effect.map(
    askedSoFar(account, organization),
    ([requests, now]) =>
      new Map(
        groups.map(({ id, members }): readonly [string, GroupStanding] => [
          id,
          members.includes(account)
            ? 'in'
            : askedAlready(requests, id, now) === undefined
              ? 'ask'
              : 'asked',
        ]),
      ),
  )

/** The admins of an Organization, by their Accounts, read now, outside any request: who is told. */
export const adminsOf = (organization: string) =>
  Effect.map(
    Organizations.use((organizations) => organizations.members(organization)),
    (found) => found.flatMap((member) => (member.role === 'admin' ? [member.account] : [])),
  )
