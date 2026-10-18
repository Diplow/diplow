import { Exit, Option, Schema } from 'effect'
import { describe, expect, it } from 'vitest'

import * as Iam from '#/domains/iam/iam'
import * as Service from '#/domains/mapping/mapping'
import { browser } from '#/repositories/auth/testing'
import { Conversations } from '#/repositories/database/conversations/conversations'

import * as Someone from '../../assistant/someone/someone'
import * as Mapping from '../../mapping/programs'
import { noKey, run, type StartContext } from '../../server/run'
import { MemberRole, OrganizationName } from './organizations'
import * as Organizations from './programs'

// Organizations through their programs, as the server functions run them, over PGlite, Better Auth
// for real, each Account signed up there: one made with its System, its star born with its name, its
// first admin standing for it, sharing it and writing there as its owner, its writes told to nobody
// but the writer; a member reading and writing there through the Members Group, which a Grant names
// by the Organization's star; each role and each removal holding from the next request on; its
// members read by its members alone and changed by its admins alone, its last admin kept; and all of
// it from a Session, never a Key.

/** How a request is proven: by a Session, or by an Account's Key. */
type Proof = 'session' | 'key'

/** Someone who just signed up, and their own star. */
async function someone(name: string) {
  const credentials = { email: `${crypto.randomUUID()}@example.com`, password: 'lovelace1815' }
  const signedUp = await run(signedOut, browser().request(Iam.signUp(credentials)))
  if (!signedUp.ok) throw new Error(`Expected a sign-up, got ${JSON.stringify(signedUp)}`)
  const account = signedUp.value
  const { root } = await value(run(request(account), Mapping.system))
  await value(
    run(request(account), Mapping.editTile({ id: root.id, version: root.version, title: name })),
  )
  return { account, star: root.id }
}

/** A request nothing proves. */
const signedOut: StartContext = {
  requestId: 'req-orgs',
  scope: 'test',
  waitUntil: () => undefined,
  exchange: {
    url: 'http://localhost/_serverFn',
    headers: new Headers(),
    setCookies: () => undefined,
  },
  session: Exit.succeed(Option.none()),
  key: noKey,
}

/** A request from this Account, proven so. */
function request(account: { id: string; email: string }, proof: Proof = 'session'): StartContext {
  const session: Iam.Session = { account, expiresAt: new Date(Date.now() + 60_000) }
  return {
    ...signedOut,
    session: Exit.succeed(proof === 'session' ? Option.some(session) : Option.none()),
    key:
      proof === 'session'
        ? noKey
        : Exit.succeed(Option.some({ account, by: { _tag: 'Key', keyId: 'k' } as const })),
  }
}

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

/** Ana's Organization, Atelier, and a Tile of its System, Plans, her its one admin. */
async function atelier() {
  const ana = await someone('Ana Lima')
  const asAna = request(ana.account)
  const { star } = await value(run(asAna, Organizations.createOrganization({ name: '  Atelier ' })))
  const plans = await value(
    run(asAna, Mapping.createTile({ parent: star, slot: 1, ...content('Plans') })),
  )
  return { ana, asAna, star, plans }
}

/** The id of the last Entry of the Conversation of this owner, none when it has no Conversation. */
const lastEntryOf = (owner: string) =>
  value(
    run(
      signedOut,
      Conversations.use((conversations) => conversations.lastEntry(owner)),
    ),
  )

describe('an Organization, made', () => {
  it('has its System, its star born with its name, its maker its owner there', async () => {
    const { ana, asAna, star, plans } = await atelier()
    const seen = await value(run(asAna, Mapping.systemAt(star)))
    expect(seen.root).toMatchObject({ id: star, title: 'Atelier' })
    expect(seen.asOwner).toBe(true)
    expect(seen.rights[plans.id]).toEqual(['read', 'write', '@'])
    expect(await value(run(asAna, Organizations.roleIn({ star })))).toBe('admin')
    // Her own System stays hers, and is no Organization's.
    expect(await value(run(asAna, Organizations.roleIn({ star: ana.star })))).toBeNull()
    expect((await value(run(asAna, Mapping.system))).root.id).toBe(ana.star)
  })

  it('keeps no timeline: its admin’s write there is told in no Conversation of its own', async () => {
    const { ana, asAna, star, plans } = await atelier()
    const edit = { id: plans.id, version: plans.version, preview: 'The year ahead.' }
    await value(run(asAna, Mapping.editTile(edit)))
    expect(await value(run(asAna, Mapping.visit({ tile: plans.id })))).toEqual({ system: star })
    const organization = await value(run(signedOut, Service.ownerOf(star)))
    expect(await lastEntryOf(organization)).toBeUndefined()
    // Whose timeline a write there tells, beside the writer's, the one rule a Turn's write and an
    // accepted Proposal there lock Conversations by: none for an Organization, the owner for an Account.
    expect(await value(run(signedOut, Someone.toldOwner(star)))).toBeUndefined()
    expect(await value(run(signedOut, Someone.toldOwner(ana.star)))).toBe(ana.account.id)
    const seen = await value(run(asAna, Mapping.systemAt(star)))
    expect(seen.tiles[plans.id]).toMatchObject({ preview: 'The year ahead.' })
  })

  it('takes a name, refusing a blank one, from a Session alone', async () => {
    const ana = await someone('Ana Lima')
    expect(
      await refusal(run(request(ana.account), Organizations.createOrganization({ name: '  ' }))),
    ).toBe('TitleMissing')
    expect(
      await refusal(
        run(request(ana.account, 'key'), Organizations.createOrganization({ name: 'Atelier' })),
      ),
    ).toBe('SessionRequired')
    expect(Schema.is(OrganizationName)({ name: 'x'.repeat(1_001) })).toBe(false)
  })

  it('is shown to a stranger by its star’s card alone', async () => {
    const { star, plans } = await atelier()
    const bob = await someone('Bob Martin')
    const seen = await value(run(request(bob.account), Mapping.systemAt(star)))
    expect(seen.root).toMatchObject({ id: star, title: 'Atelier' })
    expect(seen.asOwner).toBe(false)
    // Still a System an owner holds, which the client's `decide` writes in as Grants let it.
    expect(seen.owned).toBe(true)
    expect(seen.tiles).toEqual({})
    expect(
      await refusal(
        run(request(bob.account), Mapping.editTile({ id: plans.id, version: 1, title: 'Mine' })),
      ),
    ).toBe('TileNotFound')
    expect(await value(run(request(bob.account), Organizations.roleIn({ star })))).toBeNull()
    expect(await refusal(run(request(bob.account), Organizations.members({ star })))).toBe(
      'OrganizationNotFound',
    )
  })
})

describe("an Organization's members", () => {
  it('read and write what a Grant to its Members, named by its star, lets them', async () => {
    const { ana, asAna, star, plans } = await atelier()
    const bob = await someone('Bob Martin')
    const asBob = request(bob.account)
    await value(run(asAna, Organizations.addMember({ star, member: bob.star })))
    expect(await value(run(asBob, Organizations.roleIn({ star })))).toBe('member')
    // A member reads nothing no Grant lets them.
    expect((await value(run(asBob, Mapping.systemAt(star)))).tiles).toEqual({})
    const members = { _tag: 'Account', star } as const
    await value(
      run(asAna, Mapping.setGrant({ tile: plans.id, subject: members, value: 'read+write' })),
    )
    const reach = await value(run(asAna, Mapping.whoReaches({ tile: plans.id })))
    expect(reach.others).toMatchObject([
      { subject: { _tag: 'Group' }, value: 'read+write', star: { id: star, title: 'Atelier' } },
    ])
    const seen = await value(run(asBob, Mapping.systemAt(star)))
    expect(seen.asOwner).toBe(false)
    expect(seen.rights[plans.id]).toEqual(['read', 'write'])
    const ours = await value(
      run(asBob, Mapping.editTile({ id: plans.id, version: plans.version, title: 'Our plans' })),
    )
    expect((await value(run(asAna, Mapping.systemAt(star)))).tiles[plans.id]).toMatchObject({
      title: 'Our plans',
    })
    // Nobody but Bob is told: the Organization keeps no Conversation, and Ana hears nothing of it.
    const anasLast = await lastEntryOf(ana.account.id)
    await value(
      run(asBob, Mapping.editTile({ id: plans.id, version: ours.version, preview: 'Ours.' })),
    )
    expect(await lastEntryOf(ana.account.id)).toBe(anasLast)
    expect(await lastEntryOf(await value(run(signedOut, Service.ownerOf(star))))).toBeUndefined()
    // Sharing stays its admins': a member may not.
    expect(
      await refusal(
        run(asBob, Mapping.setGrant({ tile: plans.id, subject: members, value: 'read' })),
      ),
    ).toBe('NotAllowed')
  })

  it('stand for it once made admins, and no longer from the next request once demoted', async () => {
    const { asAna, star, plans } = await atelier()
    const bob = await someone('Bob Martin')
    const asBob = request(bob.account)
    await value(run(asAna, Organizations.addMember({ star, member: bob.star })))
    await value(run(asAna, Organizations.setMemberRole({ star, member: bob.star, role: 'admin' })))
    const asAdmin = await value(run(asBob, Mapping.systemAt(star)))
    expect(asAdmin.asOwner).toBe(true)
    expect(asAdmin.rights[plans.id]).toEqual(['read', 'write', '@'])
    const everyone = { _tag: 'Everyone' } as const
    await value(run(asBob, Mapping.setGrant({ tile: plans.id, subject: everyone, value: 'read' })))
    await value(run(asAna, Organizations.setMemberRole({ star, member: bob.star, role: 'member' })))
    const demoted = await value(run(asBob, Mapping.systemAt(star)))
    expect(demoted.asOwner).toBe(false)
    expect(demoted.rights[plans.id]).toEqual(['read'])
  })

  it('read nothing more once taken out', async () => {
    const { asAna, star, plans } = await atelier()
    const bob = await someone('Bob Martin')
    const asBob = request(bob.account)
    await value(run(asAna, Organizations.addMember({ star, member: bob.star })))
    await value(
      run(
        asAna,
        Mapping.setGrant({ tile: plans.id, subject: { _tag: 'Account', star }, value: 'read' }),
      ),
    )
    expect(Object.keys((await value(run(asBob, Mapping.systemAt(star)))).tiles)).toEqual([plans.id])
    await value(run(asAna, Organizations.removeMember({ star, member: bob.star })))
    expect((await value(run(asBob, Mapping.systemAt(star)))).tiles).toEqual({})
    expect(await value(run(asBob, Organizations.roleIn({ star })))).toBeNull()
  })

  it('are listed by their stars to each of them, changed by its admins alone', async () => {
    const { ana, asAna, star } = await atelier()
    const bob = await someone('Bob Martin')
    const cleo = await someone('Cleo Diaz')
    const asBob = request(bob.account)
    await value(run(asAna, Organizations.addMember({ star, member: bob.star })))
    const listed = await value(run(asBob, Organizations.members({ star })))
    expect(listed.map(({ star: card, ...member }) => ({ ...member, title: card?.title }))).toEqual([
      { title: 'Ana Lima', role: 'admin', you: false },
      { title: 'Bob Martin', role: 'member', you: true },
    ])
    expect(listed.map((member) => member.star?.id)).toEqual([ana.star, bob.star])
    expect(await refusal(run(asBob, Organizations.addMember({ star, member: cleo.star })))).toBe(
      'AdminRequired',
    )
    expect(await refusal(run(asAna, Organizations.addMember({ star, member: bob.star })))).toBe(
      'AlreadyMember',
    )
    // Only an Account joins: an Organization's star, or a Tile below a star, names none.
    expect(await refusal(run(asAna, Organizations.addMember({ star, member: star })))).toBe(
      'AccountNotFound',
    )
    expect(
      await refusal(run(asAna, Organizations.addMember({ star: ana.star, member: cleo.star }))),
    ).toBe('OrganizationNotFound')
    // A stranger naming a star of nobody learns nothing more than that it is no Organization of theirs.
    const asCleo = request(cleo.account)
    const nobody = crypto.randomUUID()
    for (const outcome of [
      run(asCleo, Organizations.addMember({ star, member: nobody })),
      run(asCleo, Organizations.removeMember({ star, member: nobody })),
    ]) {
      expect(await refusal(outcome)).toBe('OrganizationNotFound')
    }
    expect(await refusal(run(asAna, Organizations.addMember({ star, member: nobody })))).toBe(
      'AccountNotFound',
    )
    expect(await refusal(run(asAna, Organizations.removeMember({ star, member: nobody })))).toBe(
      'MemberNotFound',
    )
  })

  it('keep their last admin, and are managed from a Session alone', async () => {
    const { ana, asAna, star } = await atelier()
    const bob = await someone('Bob Martin')
    const demoted = Organizations.setMemberRole({ star, member: ana.star, role: 'member' })
    expect(await refusal(run(asAna, demoted))).toBe('LastAdmin')
    expect(await refusal(run(asAna, Organizations.removeMember({ star, member: ana.star })))).toBe(
      'LastAdmin',
    )
    const byKey = request(ana.account, 'key')
    for (const outcome of [
      run(byKey, Organizations.addMember({ star, member: bob.star })),
      run(byKey, Organizations.members({ star })),
      run(byKey, Organizations.roleIn({ star })),
    ]) {
      expect(await refusal(outcome)).toBe('SessionRequired')
    }
    expect(Schema.is(MemberRole)({ star, member: bob.star, role: 'owner' })).toBe(false)
  })
})
