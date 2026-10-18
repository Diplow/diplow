import { expect, layer } from '@effect/vitest'
import { Effect, Exit, Layer, Option } from 'effect'

import { Bus } from '#/domains/bus'
import { browser, TestAuth } from '#/repositories/auth/testing'
import { transactional } from '#/repositories/database/database'
import { layer as organizationsLayer } from '#/repositories/database/organizations/organizations'

import { CurrentKey, CurrentSession, signUp } from '../iam'
import {
  createGroup,
  deleteGroup,
  groups,
  groupsNamed,
  groupsToShareWith,
  renameGroup,
  setInGroup,
  shareableGroup,
} from './groups'
import {
  addMember,
  belonging,
  createOrganization,
  membersGroupOf,
  removeMember,
} from './organizations'

// An Organization's Groups of its own over PGlite, Better Auth for real beside it: made, renamed and
// deleted by its admins alone, from a Session, never a Key, each name once whatever its case; its
// members put in and taken out, its members alone; seen with who is in them by every member, hidden
// from anyone else; and who is in which read anew each time, a deleted Group's id and a member who
// left in no answer from the next read on.

/** A bus nobody listens to: what IAM publishes is the API layer's to tell. */
const Unheard = Layer.succeed(Bus)({ publish: () => Effect.void })

const TestLayer = Layer.mergeAll(Layer.provideMerge(organizationsLayer, TestAuth), Unheard)

let accounts = 0

/** Someone who just signed up, and ways to run a program as their Session, or a Key, proves them. */
const someone = Effect.gen(function* () {
  accounts += 1
  const credentials = { email: `groups-${String(accounts)}@example.com`, password: 'lovelace1815' }
  const account = yield* browser().request(signUp(credentials))
  const session = { account, expiresAt: new Date(Date.now() + 60_000) }
  const asSession = <A, E, R>(program: Effect.Effect<A, E, R>) =>
    program.pipe(
      Effect.provideService(CurrentSession, Option.some(session)),
      Effect.provideService(CurrentKey, Option.none()),
    )
  const asKey = <A, E, R>(program: Effect.Effect<A, E, R>) =>
    program.pipe(
      Effect.provideService(CurrentSession, Option.none()),
      Effect.provideService(
        CurrentKey,
        Option.some({ account, by: { _tag: 'Key', keyId: 'k' } as const }),
      ),
    )
  /** Runs a change as this Account's Session proves it, in the transaction the API layer opens. */
  const changes = <A, E, R>(program: Effect.Effect<A, E, R>) => asSession(transactional(program))
  return { account, asSession, asKey, changes }
})

/** The tag of the error a program failed with. */
const failedWith = <A, E extends { readonly _tag: string }, R>(program: Effect.Effect<A, E, R>) =>
  Effect.map(Effect.exit(program), (exit) =>
    Exit.isFailure(exit) ? Option.getOrUndefined(Exit.findErrorOption(exit))?._tag : 'succeeded',
  )

/** Ana's Organization, Bob a member of it, and Cleo, who is not. */
const atelier = Effect.gen(function* () {
  const [ana, bob, cleo] = [yield* someone, yield* someone, yield* someone]
  const team = yield* ana.changes(createOrganization)
  yield* ana.changes(addMember(team, bob.account.id))
  return { ana, bob, cleo, team }
})

layer(TestLayer)('an Organization’s Groups', (it) => {
  it.effect('are made by its admins, with members of theirs, and belonged to from then on', () =>
    Effect.gen(function* () {
      const { ana, bob, team } = yield* atelier
      const design = yield* ana.changes(createGroup(team, '  Design '))
      expect(yield* bob.asSession(groups(team))).toEqual([
        { id: design, name: 'Design', members: [] },
      ])
      yield* ana.changes(setInGroup(team, { group: design, account: bob.account.id, in: true }))
      // Twice is once.
      yield* ana.changes(setInGroup(team, { group: design, account: bob.account.id, in: true }))
      expect(yield* bob.asSession(groups(team))).toEqual([
        { id: design, name: 'Design', members: [bob.account.id] },
      ])
      expect((yield* belonging(bob.account.id)).groups).toEqual([membersGroupOf(team), design])
      expect((yield* belonging(ana.account.id)).groups).toEqual([membersGroupOf(team)])
    }),
  )

  it.effect('hold each name once, whatever its case, within one Organization alone', () =>
    Effect.gen(function* () {
      const { ana, team } = yield* atelier
      const design = yield* ana.changes(createGroup(team, 'Design'))
      const ops = yield* ana.changes(createGroup(team, 'Ops'))
      expect(yield* failedWith(ana.changes(createGroup(team, 'design')))).toBe('GroupNameTaken')
      expect(yield* failedWith(ana.changes(renameGroup(team, ops, 'DESIGN')))).toBe(
        'GroupNameTaken',
      )
      expect(yield* failedWith(ana.changes(createGroup(team, '   ')))).toBe('GroupNameInvalid')
      expect(yield* failedWith(ana.changes(createGroup(team, 'x'.repeat(41))))).toBe(
        'GroupNameInvalid',
      )
      // A Group renamed in its own case, and another Organization's Group of the same name.
      yield* ana.changes(renameGroup(team, design, 'design'))
      const other = yield* ana.changes(createOrganization)
      yield* ana.changes(createGroup(other, 'Design'))
      expect((yield* ana.asSession(groups(team))).map(({ name }) => name)).toEqual([
        'design',
        'Ops',
      ])
    }),
  )

  it.effect('are seen by every member, and by nobody else', () =>
    Effect.gen(function* () {
      const { ana, cleo, team } = yield* atelier
      yield* ana.changes(createGroup(team, 'Design'))
      expect(yield* failedWith(cleo.asSession(groups(team)))).toBe('OrganizationNotFound')
      expect(yield* failedWith(cleo.asSession(groups(crypto.randomUUID())))).toBe(
        'OrganizationNotFound',
      )
    }),
  )

  it.effect('are changed by its admins alone: a member is refused, a stranger told nothing', () =>
    Effect.gen(function* () {
      const { ana, bob, cleo, team } = yield* atelier
      const design = yield* ana.changes(createGroup(team, 'Design'))
      const asMember = yield* Effect.all([
        failedWith(bob.changes(createGroup(team, 'Mine'))),
        failedWith(bob.changes(renameGroup(team, design, 'Mine'))),
        failedWith(bob.changes(deleteGroup(team, design))),
        failedWith(
          bob.changes(setInGroup(team, { group: design, account: bob.account.id, in: true })),
        ),
      ])
      expect(asMember).toEqual(Array.from(asMember, () => 'AdminRequired'))
      expect(yield* failedWith(cleo.changes(createGroup(team, 'Mine')))).toBe(
        'OrganizationNotFound',
      )
      expect(yield* failedWith(cleo.changes(deleteGroup(team, design)))).toBe(
        'OrganizationNotFound',
      )
    }),
  )

  it.effect('take its members alone, and Groups of its own alone', () =>
    Effect.gen(function* () {
      const { ana, cleo, team } = yield* atelier
      const design = yield* ana.changes(createGroup(team, 'Design'))
      const put = (group: string, account: string) =>
        ana.changes(setInGroup(team, { group, account, in: true }))
      expect(yield* failedWith(put(design, cleo.account.id))).toBe('MemberNotFound')
      expect(yield* failedWith(put(crypto.randomUUID(), ana.account.id))).toBe('GroupNotFound')
      // Another Organization's Group is none of this one's, its Members Group neither.
      const other = yield* ana.changes(createOrganization)
      const theirs = yield* ana.changes(createGroup(other, 'Theirs'))
      expect(yield* failedWith(put(theirs, ana.account.id))).toBe('GroupNotFound')
      expect(yield* failedWith(ana.changes(deleteGroup(team, theirs)))).toBe('GroupNotFound')
      expect(yield* failedWith(ana.changes(deleteGroup(team, membersGroupOf(team))))).toBe(
        'GroupNotFound',
      )
    }),
  )

  it.effect('let go of whoever leaves, is taken out, or of everyone once deleted', () =>
    Effect.gen(function* () {
      const { ana, bob, team } = yield* atelier
      const [design, ops] = [
        yield* ana.changes(createGroup(team, 'Design')),
        yield* ana.changes(createGroup(team, 'Ops')),
      ]
      for (const group of [design, ops]) {
        yield* ana.changes(setInGroup(team, { group, account: bob.account.id, in: true }))
      }
      yield* ana.changes(setInGroup(team, { group: ops, account: bob.account.id, in: false }))
      expect((yield* belonging(bob.account.id)).groups).toEqual([membersGroupOf(team), design])
      yield* ana.changes(deleteGroup(team, design))
      expect((yield* belonging(bob.account.id)).groups).toEqual([membersGroupOf(team)])
      // A deleted Group is named by nothing, and nobody names it in a Grant again.
      expect((yield* groupsNamed([design, ops])).has(design)).toBe(false)
      expect(yield* failedWith(ana.asSession(shareableGroup(design)))).toBe('GroupNotFound')
      // Leaving the Organization leaves its Groups too.
      yield* ana.changes(setInGroup(team, { group: ops, account: bob.account.id, in: true }))
      yield* bob.changes(removeMember(team, bob.account.id))
      expect(yield* belonging(bob.account.id)).toEqual({ admins: [], groups: [] })
      expect(yield* ana.asSession(groups(team))).toEqual([{ id: ops, name: 'Ops', members: [] }])
    }),
  )

  it.effect('are named in a Grant by their Organization’s members alone', () =>
    Effect.gen(function* () {
      const { ana, bob, cleo, team } = yield* atelier
      const design = yield* ana.changes(createGroup(team, 'Design'))
      yield* bob.asSession(shareableGroup(design))
      expect(yield* failedWith(cleo.asSession(shareableGroup(design)))).toBe('GroupNotFound')
      // The Members are named by their Organization's star alone, never by its id as a Group's.
      expect(yield* failedWith(bob.asSession(shareableGroup(membersGroupOf(team))))).toBe(
        'GroupNotFound',
      )
      expect(yield* bob.asSession(groupsToShareWith)).toEqual([
        { organization: team, groups: [{ id: design, name: 'Design' }] },
      ])
      expect(yield* cleo.asSession(groupsToShareWith)).toEqual([])
      expect(yield* groupsNamed([design, team])).toEqual(
        new Map([[design, { name: 'Design', organization: team }]]),
      )
    }),
  )

  it.effect('are managed and read from a Session alone, never a Key', () =>
    Effect.gen(function* () {
      const { ana, team } = yield* atelier
      const design = yield* ana.changes(createGroup(team, 'Design'))
      const byKey = yield* Effect.all([
        failedWith(ana.asKey(transactional(createGroup(team, 'Keys')))),
        failedWith(ana.asKey(transactional(renameGroup(team, design, 'Keys')))),
        failedWith(ana.asKey(transactional(deleteGroup(team, design)))),
        failedWith(
          ana.asKey(
            transactional(setInGroup(team, { group: design, account: ana.account.id, in: true })),
          ),
        ),
        failedWith(ana.asKey(groups(team))),
        failedWith(ana.asKey(groupsToShareWith)),
        failedWith(ana.asKey(shareableGroup(design))),
      ])
      expect(byKey).toEqual(Array.from(byKey, () => 'SessionRequired'))
    }),
  )
})
