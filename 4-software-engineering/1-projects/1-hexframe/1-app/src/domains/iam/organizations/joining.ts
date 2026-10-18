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
import { isOrganization, managedBy, roleIn } from './organizations'

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
 * Why an Account may not ask to join this, by an Organization's members and its Groups: its Members,
 * for one of them (`member`); one of its Groups, for one already in it (`in-group`), and `no-group`
 * for anyone not among its members, since a Group is its members' to see, and for an id none of its
 * Groups has; none when it may. Pure.
 */
export function askRefusal(
  {
    members,
    groups,
  }: {
    readonly members: ReadonlyArray<{ readonly account: string }>
    readonly groups: ReadonlyArray<{ readonly id: string; readonly members: ReadonlyArray<string> }>
  },
  account: string,
  group: string | undefined,
): 'member' | 'in-group' | 'no-group' | undefined {
  const member = members.some((one) => one.account === account)
  if (group === undefined) return member ? 'member' : undefined
  const asked = member ? groups.find((one) => one.id === group) : undefined
  if (asked === undefined) return 'no-group'
  return asked.members.includes(account) ? 'in-group' : undefined
}

/**
 * That the asking Account may ask to join this, the Organization's row locked: `OrganizationNotFound`
 * for an id no Organization has, then as `askRefusal` says, `AlreadyMember`, `AlreadyInGroup` or
 * `GroupNotFound`. An Organization with no member yet, the Hexframe one until its admin is made by
 * hand, is asked as any other, as `standingIn` offers it: the request waits for an admin.
 */
const mayAsk = (organization: string, account: string, group: string | undefined) =>
  Effect.gen(function* () {
    const members = yield* Organizations.use((organizations) => organizations.locked(organization))
    if (members.length === 0 && !(yield* isOrganization(organization))) {
      return yield* new OrganizationNotFound()
    }
    const groups =
      group === undefined
        ? []
        : yield* Organizations.use((organizations) => organizations.groupsOf(organization))
    switch (askRefusal({ members, groups }, account, group)) {
      case 'member':
        return yield* new AlreadyMember()
      case 'in-group':
        return yield* new AlreadyInGroup()
      case 'no-group':
        return yield* new GroupNotFound()
      case undefined:
        return
    }
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
 * Some Groups of an Organization, each with where an Account stands toward it, read now: `in` it,
 * may `ask` to join it, or has `asked` (`askedAlready`). What the Groups widget offers each by.
 */
export const groupStandings = <
  G extends { readonly id: string; readonly members: ReadonlyArray<string> },
>(
  account: string,
  organization: string,
  groups: ReadonlyArray<G>,
) =>
  Effect.map(askedSoFar(account, organization), ([requests, now]) =>
    groups.map((group) => {
      const joining: GroupStanding = group.members.includes(account)
        ? 'in'
        : askedAlready(requests, group.id, now) === undefined
          ? 'ask'
          : 'asked'
      return { ...group, joining }
    }),
  )

/** The admins of an Organization, by their Accounts, read now, outside any request: who is told. */
export const adminsOf = (organization: string) =>
  Effect.map(
    Organizations.use((organizations) => organizations.members(organization)),
    (found) => found.flatMap((member) => (member.role === 'admin' ? [member.account] : [])),
  )
