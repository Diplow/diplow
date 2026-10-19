import { describe, expect, it, layer } from '@effect/vitest'
import { Effect, Exit, Layer, Option } from 'effect'
import { TestClock } from 'effect/testing'

import { Bus, type DomainEvent } from '#/domains/bus'
import { browser, TestAuth } from '#/repositories/auth/testing'
import { transactional } from '#/repositories/database/database'
import { layer as organizationsLayer } from '#/repositories/database/organizations/organizations'

import { CurrentKey, CurrentSession, signUp } from '../iam'
import { createGroup, setInGroup } from './groups'
import {
  adminsOf,
  askedAlready,
  askRefusal,
  askToJoin,
  decideJoinRequest,
  groupStandings,
  JoinAsked,
  JoinDecided,
  requestsSeen,
  standingIn,
} from './joining'
import {
  addMember,
  belonging,
  createOrganization,
  MemberAdded,
  MemberLeft,
  MemberRemoved,
  members,
  membersGroupOf,
  removeMember,
  setRole,
} from './organizations'

// Joining an Organization of one's own accord (HEX-138), over PGlite, Better Auth for real beside
// it: any Account asks to join its Members, a member one of its Groups, one request open at most
// for each; its admins alone accept or decline it, once, from a Session; accepted, the Account is a
// member who joined, or in the Group, declined nothing changes; each step a fact on the bus for the
// API layer to tell, and an added or a removed member too. Never a Key.

/** What IAM published, oldest first, for the API layer to tell. */
const published: DomainEvent[] = []

const Heard = Layer.succeed(Bus)({
  publish: (event) =>
    Effect.sync(() => {
      published.push(event)
    }),
})

const TestLayer = Layer.mergeAll(Layer.provideMerge(organizationsLayer, TestAuth), Heard)

let accounts = 0

/** Someone who just signed up, and ways to run a program as their Session or a Key of theirs. */
const someone = Effect.gen(function* () {
  accounts += 1
  const credentials = { email: `joining-${String(accounts)}@example.com`, password: 'lovelace1815' }
  const account = yield* browser().request(signUp(credentials))
  const session = { account, expiresAt: new Date(Date.now() + 60_000) }
  /** Runs `program` as a server function this Account's Session proves, in one transaction. */
  const asSession = <A, E, R>(program: Effect.Effect<A, E, R>) =>
    transactional(program).pipe(
      Effect.provideService(CurrentSession, Option.some(session)),
      Effect.provideService(CurrentKey, Option.none()),
    )
  /** Runs `program` as the MCP does for one of this Account's Keys: no Session. */
  const asKey = <A, E, R>(program: Effect.Effect<A, E, R>) =>
    transactional(program).pipe(
      Effect.provideService(CurrentSession, Option.none()),
      Effect.provideService(
        CurrentKey,
        Option.some({ account, by: { _tag: 'Key', keyId: 'k' } as const }),
      ),
    )
  return { account, asSession, asKey }
})

/** The tag of the error a program failed with, or `succeeded`. */
const failedWith = <A, E extends { readonly _tag: string }, R>(program: Effect.Effect<A, E, R>) =>
  Effect.map(Effect.exit(program), (exit) =>
    Exit.isFailure(exit) ? Option.getOrUndefined(Exit.findErrorOption(exit))?._tag : 'succeeded',
  )

/** What was published since `from`, by tag and the Account it is about. */
const heardSince = (from: number) =>
  published.slice(from).map((event) => {
    const about = event as unknown as { readonly account?: string }
    return [event._tag, about.account] as const
  })

/**
 * The Hexframe Organization, its migration's (`20261018133429_hexframe-organization`): an
 * Organization with no member, its first admin made by hand.
 */
const hexframe = '98c9e80b-a66d-4ad1-84ff-9ed917ef86eb'

/** Ana's Organization, Ana its one admin. */
const atelier = Effect.gen(function* () {
  const ana = yield* someone
  const team = yield* ana.asSession(createOrganization)
  return { ana, team }
})

layer(TestLayer)('Joining an Organization', (it) => {
  it.effect('is asked by any Account, its admins told; accepted, it joins of its own accord', () =>
    Effect.gen(function* () {
      const { ana, team } = yield* atelier
      const bob = yield* someone
      const from = published.length
      const request = yield* bob.asSession(askToJoin(team))
      expect(published.at(-1)).toEqual(
        new JoinAsked({ request, organization: team, account: bob.account.id }),
      )
      // One open at a time; nothing changes for him meanwhile.
      expect(yield* failedWith(bob.asSession(askToJoin(team)))).toBe('JoinRequestOpen')
      expect((yield* belonging(bob.account.id)).groups).toEqual([])
      expect(yield* ana.asSession(requestsSeen([request]))).toEqual(new Map([[request, 'open']]))
      yield* ana.asSession(decideJoinRequest(request, true))
      expect(published.at(-1)).toEqual(
        new JoinDecided({ request, organization: team, account: bob.account.id, accepted: true }),
      )
      expect(heardSince(from)).toEqual([
        ['JoinAsked', bob.account.id],
        ['JoinDecided', bob.account.id],
      ])
      expect(yield* ana.asSession(members(team))).toEqual([
        { account: ana.account.id, role: 'admin', joined: true },
        { account: bob.account.id, role: 'member', joined: true },
      ])
      expect((yield* belonging(bob.account.id)).groups).toEqual([membersGroupOf(team)])
      expect(yield* ana.asSession(requestsSeen([request]))).toEqual(
        new Map([[request, 'accepted']]),
      )
      // Decided once; a member now, he asks no more.
      expect(yield* failedWith(ana.asSession(decideJoinRequest(request, false)))).toBe(
        'JoinRequestDecided',
      )
      expect(yield* failedWith(bob.asSession(askToJoin(team)))).toBe('AlreadyMember')
      // Having joined, made an admin, he may hold its last place: Ana may leave.
      yield* ana.asSession(setRole(team, bob.account.id, 'admin'))
      yield* ana.asSession(removeMember(team, ana.account.id))
      expect((yield* belonging(bob.account.id)).admins).toEqual([team])
    }),
  )

  it.effect('declined, changes nothing, and may be asked again', () =>
    Effect.gen(function* () {
      const { ana, team } = yield* atelier
      const bob = yield* someone
      expect(yield* bob.asSession(standingIn(team))).toBe('outside')
      const request = yield* bob.asSession(askToJoin(team))
      expect(yield* bob.asSession(standingIn(team))).toBe('asked')
      yield* ana.asSession(decideJoinRequest(request, false))
      expect(published.at(-1)).toMatchObject({ _tag: 'JoinDecided', accepted: false })
      expect(yield* ana.asSession(members(team))).toHaveLength(1)
      expect((yield* belonging(bob.account.id)).groups).toEqual([])
      expect(yield* ana.asSession(requestsSeen([request]))).toEqual(
        new Map([[request, 'declined']]),
      )
      // Not again at once, so a declined Account fills no admin's timeline: the next day.
      expect(yield* failedWith(bob.asSession(askToJoin(team)))).toBe('JoinRequestDeclined')
      expect(yield* bob.asSession(standingIn(team))).toBe('asked')
      yield* TestClock.adjust('25 hours')
      expect(yield* bob.asSession(standingIn(team))).toBe('outside')
      const again = yield* bob.asSession(askToJoin(team))
      expect(again).not.toBe(request)
    }),
  )

  it.effect('is decided by its admins alone, from a Session, and asked from one', () =>
    Effect.gen(function* () {
      const { ana, team } = yield* atelier
      const [bob, cleo, dan] = [yield* someone, yield* someone, yield* someone]
      yield* ana.asSession(addMember(team, cleo.account.id))
      const request = yield* bob.asSession(askToJoin(team))
      // A member, a stranger and a Key alike know of no such request.
      expect(yield* failedWith(cleo.asSession(decideJoinRequest(request, true)))).toBe(
        'JoinRequestNotFound',
      )
      expect(yield* failedWith(dan.asSession(decideJoinRequest(request, true)))).toBe(
        'JoinRequestNotFound',
      )
      expect(yield* failedWith(ana.asKey(decideJoinRequest(request, true)))).toBe('SessionRequired')
      expect(yield* failedWith(ana.asSession(decideJoinRequest(crypto.randomUUID(), true)))).toBe(
        'JoinRequestNotFound',
      )
      expect(yield* failedWith(dan.asKey(askToJoin(team)))).toBe('SessionRequired')
      expect(yield* failedWith(dan.asSession(askToJoin(crypto.randomUUID())))).toBe(
        'OrganizationNotFound',
      )
      // How it stands is its admins' to read alone.
      expect(yield* cleo.asSession(requestsSeen([request]))).toEqual(new Map())
      expect(yield* dan.asSession(requestsSeen([request]))).toEqual(new Map())
    }),
  )

  it.effect('of one of its Groups is a member’s, put in once accepted', () =>
    Effect.gen(function* () {
      const { ana, team } = yield* atelier
      const [bob, dan] = [yield* someone, yield* someone]
      yield* ana.asSession(addMember(team, bob.account.id))
      const design = yield* ana.asSession(createGroup(team, 'Design'))
      // A Group is its members' to see: a stranger asks for none.
      expect(yield* failedWith(dan.asSession(askToJoin(team, design)))).toBe('GroupNotFound')
      expect(yield* failedWith(bob.asSession(askToJoin(team, crypto.randomUUID())))).toBe(
        'GroupNotFound',
      )
      const request = yield* bob.asSession(askToJoin(team, design))
      expect(published.at(-1)).toEqual(
        new JoinAsked({ request, organization: team, group: design, account: bob.account.id }),
      )
      const towardDesign = (members: ReadonlyArray<string> = []) =>
        Effect.map(
          groupStandings(bob.account.id, team, [{ id: design, members }]),
          ([standing]) => standing?.joining,
        )
      expect(yield* towardDesign()).toBe('asked')
      expect(yield* failedWith(bob.asSession(askToJoin(team, design)))).toBe('JoinRequestOpen')
      yield* ana.asSession(decideJoinRequest(request, true))
      expect((yield* belonging(bob.account.id)).groups).toEqual([membersGroupOf(team), design])
      expect(yield* towardDesign([bob.account.id])).toBe('in')
      expect(yield* failedWith(bob.asSession(askToJoin(team, design)))).toBe('AlreadyInGroup')
      // Taken out of it, he asks again; put back in by Ana, his request has nothing left to decide.
      const out = { group: design, account: bob.account.id, in: false }
      yield* ana.asSession(setInGroup(team, out))
      const back = yield* bob.asSession(askToJoin(team, design))
      yield* ana.asSession(setInGroup(team, { ...out, in: true }))
      expect(yield* ana.asSession(requestsSeen([back]))).toEqual(new Map())
      // Out again and asking, once he leaves the Organization, his request goes with him.
      yield* ana.asSession(setInGroup(team, out))
      const again = yield* bob.asSession(askToJoin(team, design))
      yield* bob.asSession(removeMember(team, bob.account.id))
      expect(yield* towardDesign()).toBe('ask')
      expect(yield* failedWith(ana.asSession(decideJoinRequest(again, true)))).toBe(
        'JoinRequestNotFound',
      )
    }),
  )

  it.effect('of an Organization with no admin yet is asked as offered, waiting for one', () =>
    Effect.gen(function* () {
      const bob = yield* someone
      // Offered Ask to join, he asks, and the request waits for the admin made by hand.
      expect(yield* bob.asSession(standingIn(hexframe))).toBe('outside')
      const request = yield* bob.asSession(askToJoin(hexframe))
      expect(published.at(-1)).toEqual(
        new JoinAsked({ request, organization: hexframe, account: bob.account.id }),
      )
      expect(yield* bob.asSession(standingIn(hexframe))).toBe('asked')
      expect(yield* adminsOf(hexframe)).toEqual([])
      expect(yield* failedWith(bob.asSession(askToJoin(hexframe)))).toBe('JoinRequestOpen')
      // A Group of it is still its members' to see.
      expect(yield* failedWith(bob.asSession(askToJoin(hexframe, crypto.randomUUID())))).toBe(
        'GroupNotFound',
      )
    }),
  )
})

layer(TestLayer)('Adding, removing and leaving', (it) => {
  it.effect('drops a request once its Account is added, so none brings back someone who left', () =>
    Effect.gen(function* () {
      const { ana, team } = yield* atelier
      const bob = yield* someone
      const request = yield* bob.asSession(askToJoin(team))
      yield* ana.asSession(addMember(team, bob.account.id))
      expect(yield* ana.asSession(requestsSeen([request]))).toEqual(new Map())
      yield* bob.asSession(removeMember(team, bob.account.id))
      expect(yield* failedWith(ana.asSession(decideJoinRequest(request, true)))).toBe(
        'JoinRequestNotFound',
      )
      expect((yield* belonging(bob.account.id)).groups).toEqual([])
      // Gone, he may ask anew.
      yield* bob.asSession(askToJoin(team))
    }),
  )

  it.effect(
    'tells whoever an admin adds or takes out apart from whoever leaves, by the fact alone',
    () =>
      Effect.gen(function* () {
        const { ana, team } = yield* atelier
        const bob = yield* someone
        const from = published.length
        yield* ana.asSession(addMember(team, bob.account.id))
        yield* ana.asSession(removeMember(team, bob.account.id))
        yield* ana.asSession(addMember(team, bob.account.id))
        yield* bob.asSession(removeMember(team, bob.account.id))
        const facts = [MemberAdded, MemberRemoved, MemberAdded, MemberLeft].map(
          (Fact) => new Fact({ organization: team, account: bob.account.id }),
        )
        expect(published.slice(from)).toEqual(facts)
      }),
  )
})

describe('who may ask for what', () => {
  const members = [{ account: 'ana' }, { account: 'bob' }]
  const groups = [{ id: 'design', members: ['bob'] }]

  it('is anyone outside for the Members, a member not in it for a Group, seen by members alone', () => {
    expect(askRefusal({ members, groups }, 'dan', undefined)).toBeUndefined()
    expect(askRefusal({ members, groups }, 'ana', undefined)).toBe('member')
    expect(askRefusal({ members, groups }, 'ana', 'design')).toBeUndefined()
    expect(askRefusal({ members, groups }, 'bob', 'design')).toBe('in-group')
    expect(askRefusal({ members, groups }, 'dan', 'design')).toBe('no-group')
    expect(askRefusal({ members, groups }, 'ana', 'ops')).toBe('no-group')
  })
})

describe('asking again', () => {
  const day = 24 * 60 * 60_000
  const now = 10 * day
  const decided = (state: 'accepted' | 'declined', ago: number, group?: string) => ({
    group,
    state,
    decidedAt: new Date(now - ago),
  })

  it('waits while one for the same is open, and a day after one declined, for the same alone', () => {
    const open = { group: 'design', state: 'open' as const, decidedAt: undefined }
    expect(askedAlready([open], 'design', now)).toBe('open')
    expect(askedAlready([open], undefined, now)).toBeUndefined()
    expect(askedAlready([decided('declined', day - 1)], undefined, now)).toBe('declined')
    expect(askedAlready([decided('declined', day)], undefined, now)).toBeUndefined()
    expect(askedAlready([decided('accepted', 1)], undefined, now)).toBeUndefined()
    expect(askedAlready([decided('declined', 1, 'ops')], 'design', now)).toBeUndefined()
  })
})
