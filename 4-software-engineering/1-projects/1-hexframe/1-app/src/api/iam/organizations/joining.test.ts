import { type Effect, Exit, Option, Redacted, Schema } from 'effect'
import { describe, expect, it } from 'vitest'

import type { Entry } from '#/domains/assistant/entities'
import * as Iam from '#/domains/iam/iam'
import { hexframeStar } from '#/domains/mapping/entities'
import { browser } from '#/repositories/auth/testing'

import * as Assistant from '../../assistant/programs'
import * as Proposal from '../../assistant/proposal/programs'
import * as Mapping from '../../mapping/programs'
import { turnStarted } from '../../server/events/testing'
import { bearer, call, connect } from '../../server/mcp/testing'
import type { Failure } from '../../report/errors/failure'
import { noKey, run, type Services, type StartContext } from '../../server/run'
import { JoinDecision } from './organizations'
import * as Organizations from './programs'

// Joining and leaving an Organization (HEX-138) through the programs, as the server functions run
// them, over PGlite, Better Auth for real, the bus's work waited for as the platform waits for it:
// someone asking to join, every admin told in their timeline, Accept and Decline there, how the
// request stands read anew with the day, whoever asked told the outcome; an accepted request giving
// membership and the rights the Organization's Grants carry, a declined one nothing, a second open
// one refused, one to the Hexframe Organization, with no admin yet, waiting for one; someone added
// or taken out told, leaving telling nothing; a removed member's read and their running Turn's next
// write refused, since who belongs where is read on every call; and the last admin who joined kept,
// someone who joined by asking able to take that place.

/** Someone signed up, their star titled, and a way to run a program as their Session proves them. */
async function someone(name: string, email = `${crypto.randomUUID()}@example.com`) {
  const device = browser()
  const pending: Array<Promise<unknown>> = []
  const context = (): StartContext => ({
    requestId: 'req-joining',
    scope: 'test',
    waitUntil: (promise) => void pending.push(promise),
    exchange: device.exchange(),
    session: Exit.succeed(Option.none()),
    key: noKey,
  })
  await value(run(context(), Iam.signUp({ email, password: 'lovelace1815' })))
  const session = await value(run(context(), Iam.proven))
  const signedIn: StartContext = { ...context(), session: Exit.succeed(session) }
  const asKey: StartContext = {
    ...context(),
    key: Exit.succeed(
      Option.map(session, ({ account }) => ({ account, by: { _tag: 'Key', keyId: 'k' } as const })),
    ),
  }
  /** Runs a program for this Session, and waits for what it handed to waitUntil, its telling. */
  const as = async <A, E extends Failure>(
    program: Effect.Effect<A, E, Services>,
    proof: StartContext = signedIn,
  ) => {
    const outcome = await run(proof, program)
    await Promise.all(pending)
    return outcome
  }
  const { account } = await value(as(Iam.signedIn))
  const { root } = await value(as(Mapping.system))
  await value(as(Mapping.editTile({ id: root.id, version: root.version, title: name })))
  return { account, star: root.id, signedIn, as, asKey }
}

type Someone = Awaited<ReturnType<typeof someone>>

/** The value of a call that must succeed. */
async function value<A>(outcome: Promise<{ ok: true; value: A } | { ok: false }>): Promise<A> {
  const settled = await outcome
  if (!settled.ok) throw new Error(`Expected a success, got ${JSON.stringify(settled)}`)
  return settled.value
}

/** What a call that must fail failed with, by its tag. */
async function refusal(outcome: Promise<{ ok: true } | { ok: false; failure: { _tag: string } }>) {
  const settled = await outcome
  return settled.ok ? 'succeeded' : settled.failure._tag
}

const content = (title: string) => ({ title, preview: `${title}, in short.`, body: `# ${title}` })

/** Today, as someone's timeline reads it: its Entries and how the requests they name stand. */
const today = (who: Someone) => value(who.as(Assistant.conversationDay({ offset: 0 })))

/** What an Organization's admins or members were told today, the Entries of those two kinds. */
const told = async (who: Someone) =>
  (await today(who)).entries.flatMap((entry: Entry) =>
    entry._tag === 'Membership' || entry._tag === 'AskedToJoin' ? [entry] : [],
  )

/** The Tiles of the Organization's System someone may read, by id. */
const reads = async (who: Someone, star: string) =>
  Object.keys((await value(who.as(Mapping.systemAt(star)))).tiles)

/**
 * Ana's Organization, Atelier, with Plans in its System shared with its members at `shared`, and Dan,
 * added by her and made an admin, so it has two to tell.
 */
async function atelier(shared: 'read' | 'read+write+@' = 'read') {
  const ana = await someone('Ana Lima')
  const dan = await someone('Dan Okafor')
  const { star } = await value(ana.as(Organizations.createOrganization({ name: 'Atelier' })))
  const plans = await value(
    ana.as(Mapping.createTile({ parent: star, slot: 1, ...content('Plans') })),
  )
  const members = { _tag: 'Account', star } as const
  await value(ana.as(Mapping.setGrant({ tile: plans.id, subject: members, value: shared })))
  await value(ana.as(Organizations.addMember({ star, member: dan.star })))
  await value(ana.as(Organizations.setMemberRole({ star, member: dan.star, role: 'admin' })))
  return { ana, dan, star, plans }
}

/** Bob, the Account `vitest.config.ts` lists entitled, so he runs a Turn: once per file. */
const entitledBob = someone('Bob Martin', 'entitled@example.com')

describe('a request to join an Organization', () => {
  it('reaches every admin; accepted by one, it gives membership and what its Grants let it read', async () => {
    const { ana, dan, star, plans } = await atelier()
    const bob = await someone('Bob Martin')
    expect(await value(bob.as(Organizations.standingIn({ star })))).toBe('outside')
    expect(await reads(bob, star)).toEqual([])
    expect(await value(bob.as(Organizations.askToJoin({ star })))).toBeNull()
    // Asked, the star's menu offers it no more, and asking again is refused.
    expect(await value(bob.as(Organizations.standingIn({ star })))).toBe('asked')
    expect(await refusal(bob.as(Organizations.askToJoin({ star })))).toBe('JoinRequestOpen')
    // Each admin is told, Accept and Decline offered while it is open.
    const atelierStar = { id: star, title: 'Atelier' }
    for (const admin of [ana, dan]) {
      const [asked] = (await told(admin)).filter((entry) => entry._tag === 'AskedToJoin')
      expect(asked).toMatchObject({ by: 'Bob Martin', organization: atelierStar })
      if (asked?._tag !== 'AskedToJoin') throw new Error('Expected a request')
      expect((await today(admin)).requests).toEqual({ [asked.request]: 'open' })
    }
    const [asked] = await told(ana)
    if (asked?._tag !== 'AskedToJoin') throw new Error('Expected a request')
    const decision = { request: asked.request, accept: true }
    // Its admins' alone to decide, from a Session.
    expect(await refusal(bob.as(Organizations.decideJoinRequest(decision)))).toBe(
      'JoinRequestNotFound',
    )
    expect(await refusal(dan.as(Organizations.decideJoinRequest(decision), dan.asKey))).toBe(
      'SessionRequired',
    )
    expect(await value(dan.as(Organizations.decideJoinRequest(decision)))).toBeNull()
    // Decided by Dan, Ana's timeline says so, and offers it no more.
    expect((await today(ana)).requests).toEqual({ [asked.request]: 'accepted' })
    expect(await refusal(ana.as(Organizations.decideJoinRequest(decision)))).toBe(
      'JoinRequestDecided',
    )
    expect(await told(bob)).toMatchObject([
      { _tag: 'Membership', what: 'accepted', by: 'Dan Okafor', organization: atelierStar },
    ])
    expect(await value(bob.as(Organizations.standingIn({ star })))).toBe('member')
    expect(await reads(bob, star)).toEqual([plans.id])
    expect(Schema.is(JoinDecision)({ request: 'not-a-uuid', accept: true })).toBe(false)
  })

  it('declined, gives nothing, whoever asked told so', async () => {
    const { ana, star } = await atelier()
    const bob = await someone('Bob Martin')
    await value(bob.as(Organizations.askToJoin({ star })))
    const [asked] = await told(ana)
    if (asked?._tag !== 'AskedToJoin') throw new Error('Expected a request')
    await value(ana.as(Organizations.decideJoinRequest({ request: asked.request, accept: false })))
    expect(await told(bob)).toMatchObject([
      { _tag: 'Membership', what: 'declined', by: 'Ana Lima' },
    ])
    expect(await value(bob.as(Organizations.standingIn({ star })))).toBe('asked')
    expect(await reads(bob, star)).toEqual([])
    expect(await refusal(bob.as(Organizations.members({ star })))).toBe('OrganizationNotFound')
  })

  it('to the Hexframe Organization, offered while it has no admin, waits for one', async () => {
    const bob = await someone('Bob Martin')
    const star = hexframeStar
    expect(await value(bob.as(Organizations.standingIn({ star })))).toBe('outside')
    expect(await value(bob.as(Organizations.askToJoin({ star })))).toBeNull()
    expect(await value(bob.as(Organizations.standingIn({ star })))).toBe('asked')
    expect(await refusal(bob.as(Organizations.askToJoin({ star })))).toBe('JoinRequestOpen')
  })

  it('of one of its Groups is a member’s, its outcome told by the Group’s name', async () => {
    const { ana, star } = await atelier()
    const bob = await someone('Bob Martin')
    await value(ana.as(Organizations.addMember({ star, member: bob.star })))
    const { id: design } = await value(ana.as(Organizations.createGroup({ star, name: 'Design' })))
    const stranger = await someone('Eve Stone')
    expect(await refusal(stranger.as(Organizations.askToJoin({ star, group: design })))).toBe(
      'GroupNotFound',
    )
    await value(bob.as(Organizations.askToJoin({ star, group: design })))
    expect(await value(bob.as(Organizations.groups({ star })))).toMatchObject([
      { id: design, joining: 'asked' },
    ])
    const asked = (await told(ana)).find((entry) => entry._tag === 'AskedToJoin')
    expect(asked).toMatchObject({ by: 'Bob Martin', group: 'Design' })
    if (asked?._tag !== 'AskedToJoin') throw new Error('Expected a request')
    await value(ana.as(Organizations.decideJoinRequest({ request: asked.request, accept: true })))
    const [group] = await value(bob.as(Organizations.groups({ star })))
    expect(group).toMatchObject({ joining: 'in', members: [{ you: true }] })
    expect((await told(bob)).at(-1)).toMatchObject({
      _tag: 'Membership',
      what: 'accepted',
      group: 'Design',
    })
    expect(await refusal(bob.as(Organizations.askToJoin({ star, group: design })))).toBe(
      'AlreadyInGroup',
    )
    expect(await refusal(bob.as(Organizations.askToJoin({ star })))).toBe('AlreadyMember')
  })
})

describe('being added, removed, or leaving', () => {
  it('is told but for leaving, and holds from the next call on, a running Turn’s write included', async () => {
    const { ana, star, plans } = await atelier('read+write+@')
    const bob = await entitledBob
    await value(ana.as(Organizations.addMember({ star, member: bob.star })))
    expect(await told(bob)).toMatchObject([
      { _tag: 'Membership', what: 'added', by: 'Ana Lima', organization: { id: star } },
    ])
    // His Turn on Plans, in Atelier's System, writing as he may there.
    await value(bob.as(Proposal.setMode({ mode: 'apply' })))
    const { turn, key } = await value(bob.as(turnStarted(`@[${plans.id}] tidy this`, plans.id)))
    const client = await connect(bearer(Redacted.value(key.secret)))
    const edit = { id: plans.id, version: plans.version, preview: 'The year ahead.' }
    expect(await call(client, 'edit_tile', edit)).toMatchObject({ value: {} })
    await value(ana.as(Organizations.removeMember({ star, member: bob.star })))
    // From the next call on: his read and his running Turn's write, which no copy keeps.
    expect(await reads(bob, star)).toEqual([])
    const next = await call(client, 'edit_tile', { ...edit, version: plans.version + 1 })
    expect(next.error?.split(':')[0]).toBe('TileNotFound')
    await client.close()
    await value(bob.as(Assistant.endTurn(bob.account.id, turn.id, 'answered')))
    expect((await told(bob)).at(-1)).toMatchObject({
      _tag: 'Membership',
      what: 'removed',
      by: 'Ana Lima',
    })
    // Added again, he leaves of his own accord: nothing more is told him.
    await value(ana.as(Organizations.addMember({ star, member: bob.star })))
    const before = (await told(bob)).length
    await value(bob.as(Organizations.removeMember({ star, member: bob.star })))
    expect(await told(bob)).toHaveLength(before)
    expect(await value(bob.as(Organizations.standingIn({ star })))).toBe('outside')
  })

  it('keeps the last admin who joined, whose place someone who asked may take', async () => {
    const { ana, dan, star } = await atelier()
    // Dan was added, not asked: Ana, its maker, stays its last admin who joined.
    expect(await refusal(ana.as(Organizations.removeMember({ star, member: ana.star })))).toBe(
      'LastAdmin',
    )
    const bob = await someone('Bob Martin')
    await value(bob.as(Organizations.askToJoin({ star })))
    const [asked] = await told(ana)
    if (asked?._tag !== 'AskedToJoin') throw new Error('Expected a request')
    await value(dan.as(Organizations.decideJoinRequest({ request: asked.request, accept: true })))
    await value(ana.as(Organizations.setMemberRole({ star, member: bob.star, role: 'admin' })))
    expect(await value(ana.as(Organizations.removeMember({ star, member: ana.star })))).toBeNull()
    expect(await value(ana.as(Organizations.standingIn({ star })))).toBe('outside')
  })
})
