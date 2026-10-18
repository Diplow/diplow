import { describe, expect, it, layer } from '@effect/vitest'
import { Effect, Exit, Layer, Option } from 'effect'

import { browser, TestAuth } from '#/repositories/auth/testing'
import { transactional } from '#/repositories/database/database'
import { layer as organizationsLayer } from '#/repositories/database/organizations/organizations'

import { CurrentKey, CurrentSession, signUp } from '../iam'
import {
  addMember,
  belonging,
  createOrganization,
  isOrganization,
  members,
  membersGroupOf,
  removeMember,
  setRole,
} from './organizations'

// Organizations over PGlite, Better Auth for real beside it, its Accounts signed up there: one made
// by an Account, its first admin; its members read by them, added, made admins or members and taken
// out by its admins alone, from a Session, never a Key; its last admin kept; and who an Account
// stands for and belongs to, read anew each time.

const TestLayer = Layer.provideMerge(organizationsLayer, TestAuth)

let accounts = 0

/** Someone who just signed up, and a way to run a program as their Session proves them. */
const someone = Effect.gen(function* () {
  accounts += 1
  const credentials = { email: `orgs-${String(accounts)}@example.com`, password: 'lovelace1815' }
  const account = yield* browser().request(signUp(credentials))
  const session = { account, expiresAt: new Date(Date.now() + 60_000) }
  /** Runs `program` as a server function this Account's Session proves. */
  const asSession = <A, E, R>(program: Effect.Effect<A, E, R>) =>
    program.pipe(
      Effect.provideService(CurrentSession, Option.some(session)),
      Effect.provideService(CurrentKey, Option.none()),
    )
  /** Runs `program` as the MCP does for one of this Account's Keys: no Session. */
  const asKey = <A, E, R>(program: Effect.Effect<A, E, R>) =>
    program.pipe(
      Effect.provideService(CurrentSession, Option.none()),
      Effect.provideService(
        CurrentKey,
        Option.some({ account, by: { _tag: 'Key', keyId: 'k' } as const }),
      ),
    )
  return { account, asSession, asKey }
})

/** An Organization one Account just made, in the transaction the API layer opens around it. */
const madeBy = (founder: Effect.Success<typeof someone>) =>
  founder.asSession(transactional(createOrganization))

/** The tag of the error a program failed with. */
const failedWith = <A, E extends { readonly _tag: string }, R>(program: Effect.Effect<A, E, R>) =>
  Effect.map(Effect.exit(program), (exit) =>
    Exit.isFailure(exit) ? Option.getOrUndefined(Exit.findErrorOption(exit))?._tag : 'succeeded',
  )

layer(TestLayer)('Organizations', (it) => {
  it.effect('are made by any Account, its first and only admin, standing for it', () =>
    Effect.gen(function* () {
      const ana = yield* someone
      const team = yield* madeBy(ana)
      expect(yield* isOrganization(team)).toBe(true)
      expect(yield* isOrganization(ana.account.id)).toBe(false)
      expect(yield* ana.asSession(members(team))).toEqual([
        { account: ana.account.id, role: 'admin' },
      ])
      expect(yield* belonging(ana.account.id)).toEqual({
        admins: [team],
        groups: [membersGroupOf(team)],
      })
    }),
  )

  it.effect('take a member an admin adds, without asking, in its Members Group alone', () =>
    Effect.gen(function* () {
      const [ana, bob] = [yield* someone, yield* someone]
      const team = yield* madeBy(ana)
      yield* ana.asSession(transactional(addMember(team, bob.account.id)))
      expect(yield* bob.asSession(members(team))).toEqual([
        { account: ana.account.id, role: 'admin' },
        { account: bob.account.id, role: 'member' },
      ])
      expect(yield* belonging(bob.account.id)).toEqual({
        admins: [],
        groups: [membersGroupOf(team)],
      })
      expect(yield* failedWith(ana.asSession(transactional(addMember(team, bob.account.id))))).toBe(
        'AlreadyMember',
      )
    }),
  )

  it.effect('take Accounts alone, never an Organization nor an id no Account has', () =>
    Effect.gen(function* () {
      const ana = yield* someone
      const [team, other] = [yield* madeBy(ana), yield* madeBy(ana)]
      const added = (account: string) => ana.asSession(transactional(addMember(team, account)))
      expect(yield* failedWith(added(other))).toBe('AccountNotFound')
      expect(yield* failedWith(added(crypto.randomUUID()))).toBe('AccountNotFound')
    }),
  )

  it.effect('are managed by their admins alone, hidden from anyone not among their members', () =>
    Effect.gen(function* () {
      const [ana, bob, cleo] = [yield* someone, yield* someone, yield* someone]
      const team = yield* madeBy(ana)
      yield* ana.asSession(transactional(addMember(team, bob.account.id)))
      const byBob = [
        addMember(team, cleo.account.id),
        setRole(team, bob.account.id, 'admin'),
        removeMember(team, ana.account.id),
      ]
      for (const change of byBob) {
        expect(yield* failedWith(bob.asSession(transactional(change)))).toBe('AdminRequired')
      }
      expect(yield* failedWith(cleo.asSession(members(team)))).toBe('OrganizationNotFound')
      expect(
        yield* failedWith(cleo.asSession(transactional(addMember(team, cleo.account.id)))),
      ).toBe('OrganizationNotFound')
      expect(yield* failedWith(cleo.asSession(members(crypto.randomUUID())))).toBe(
        'OrganizationNotFound',
      )
    }),
  )

  it.effect('keep their last admin: never demoted nor removed, leaving once another is one', () =>
    Effect.gen(function* () {
      const [ana, bob] = [yield* someone, yield* someone]
      const team = yield* madeBy(ana)
      const byAna = <A, E, R>(program: Effect.Effect<A, E, R>) => ana.asSession(transactional(program))
      expect(yield* failedWith(byAna(setRole(team, ana.account.id, 'member')))).toBe('LastAdmin')
      expect(yield* failedWith(byAna(removeMember(team, ana.account.id)))).toBe('LastAdmin')
      yield* byAna(addMember(team, bob.account.id))
      yield* byAna(setRole(team, bob.account.id, 'admin'))
      expect((yield* belonging(bob.account.id)).admins).toEqual([team])
      yield* byAna(removeMember(team, ana.account.id))
      expect(yield* belonging(ana.account.id)).toEqual({ admins: [], groups: [] })
      expect(yield* bob.asSession(members(team))).toEqual([
        { account: bob.account.id, role: 'admin' },
      ])
      const byBob = <A, E, R>(program: Effect.Effect<A, E, R>) => bob.asSession(transactional(program))
      expect(yield* failedWith(byBob(setRole(team, bob.account.id, 'member')))).toBe('LastAdmin')
      expect(yield* failedWith(byBob(removeMember(team, ana.account.id)))).toBe('MemberNotFound')
    }),
  )

  it.effect('hold a demotion and a removal from the next read on', () =>
    Effect.gen(function* () {
      const [ana, bob] = [yield* someone, yield* someone]
      const team = yield* madeBy(ana)
      const byAna = <A, E, R>(program: Effect.Effect<A, E, R>) => ana.asSession(transactional(program))
      yield* byAna(addMember(team, bob.account.id))
      yield* byAna(setRole(team, bob.account.id, 'admin'))
      expect((yield* belonging(bob.account.id)).admins).toEqual([team])
      yield* byAna(setRole(team, bob.account.id, 'member'))
      expect(yield* belonging(bob.account.id)).toEqual({ admins: [], groups: [team] })
      yield* byAna(removeMember(team, bob.account.id))
      expect(yield* belonging(bob.account.id)).toEqual({ admins: [], groups: [] })
    }),
  )

  it.effect('are made and managed from a Session alone, never by a Key', () =>
    Effect.gen(function* () {
      const [ana, bob] = [yield* someone, yield* someone]
      const team = yield* madeBy(ana)
      expect(yield* failedWith(ana.asKey(transactional(createOrganization)))).toBe(
        'SessionRequired',
      )
      expect(yield* failedWith(ana.asKey(transactional(addMember(team, bob.account.id))))).toBe(
        'SessionRequired',
      )
      expect(yield* failedWith(ana.asKey(members(team)))).toBe('SessionRequired')
      expect(yield* ana.asSession(members(team))).toHaveLength(1)
    }),
  )
})

describe('the Members Group', () => {
  it("is named by its Organization's own id, kept by no row", () => {
    expect(membersGroupOf('team')).toBe('team')
  })
})
