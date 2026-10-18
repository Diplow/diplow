import { Exit, Option, Schema } from 'effect'
import { describe, expect, it } from 'vitest'

import * as Iam from '#/domains/iam/iam'
import { browser } from '#/repositories/auth/testing'

import * as Mapping from '../../mapping/programs'
import { noKey, run, type StartContext } from '../../server/run'
import { GroupRenamed, NewGroup } from './groups'
import * as Organizations from './programs'

// An Organization's Groups of its own through their programs, as the server functions run them, over
// PGlite, Better Auth for real, each Account signed up there: the grill's scenario with a real Group,
// a Grant to it reaching whoever is in it, on the canvas and through a Key as the MCP reads, and
// nobody else, its members' and strangers' alike; who is in it changed, and its deletion, holding
// from the next request on, the who-reaches list then leaving it out, or saying it gone where its
// Grant is set, for its owner to clear; its Groups seen by every member and changed by its admins
// alone; a Group named in a Grant by its Organization's members alone; and all of it from a Session,
// never a Key.

/** How a request is proven: by a Session, or by an Account's Key. */
type Proof = 'session' | 'key'

/** A request nothing proves. */
const signedOut: StartContext = {
  requestId: 'req-groups',
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

/** Someone who just signed up, their own star named, and a request their Session proves. */
async function someone(name: string) {
  const credentials = { email: `${crypto.randomUUID()}@example.com`, password: 'lovelace1815' }
  const signedUp = await run(signedOut, browser().request(Iam.signUp(credentials)))
  if (!signedUp.ok) throw new Error(`Expected a sign-up, got ${JSON.stringify(signedUp)}`)
  const account = signedUp.value
  const as = request(account)
  const { root } = await value(run(as, Mapping.system))
  await value(run(as, Mapping.editTile({ id: root.id, version: root.version, title: name })))
  return { account, star: root.id, as }
}

const content = (title: string) => ({ title, preview: `${title}, in short.`, body: `# ${title}` })

/**
 * Atelier, Ana its admin, Bob and Cleo its members, a Group of its own, Design, Bob alone in it; and
 * Ana's own System as the grill tells it, her star, Journal below it with an Entry, and Garden.
 */
async function atelier() {
  const [ana, bob, cleo, dan] = await Promise.all([
    someone('Ana Lima'),
    someone('Bob Martin'),
    someone('Cleo Diaz'),
    someone('Dan Wu'),
  ])
  const { star } = await value(run(ana.as, Organizations.createOrganization({ name: 'Atelier' })))
  for (const member of [bob, cleo]) {
    await value(run(ana.as, Organizations.addMember({ star, member: member.star })))
  }
  const { id: design } = await value(
    run(ana.as, Organizations.createGroup({ star, name: 'Design' })),
  )
  const placed = { star, group: design, member: bob.star, in: true }
  await value(run(ana.as, Organizations.setInGroup(placed)))
  const journal = await value(
    run(ana.as, Mapping.createTile({ parent: ana.star, slot: 1, ...content('Journal') })),
  )
  const entry = await value(
    run(ana.as, Mapping.createTile({ parent: journal.id, slot: 1, ...content('Entry') })),
  )
  const garden = await value(
    run(ana.as, Mapping.createTile({ parent: ana.star, slot: 2, ...content('Garden') })),
  )
  return { ana, bob, cleo, dan, star, design, journal, entry, garden }
}

/** The Titles of the Tiles someone reads of a System, by their ids, its star's aside. */
async function titlesSeen(as: StartContext, star: string) {
  const seen = await value(run(as, Mapping.systemAt(star)))
  return Object.fromEntries(
    Object.values(seen.tiles).flatMap((tile) =>
      tile._tag === 'Tile' ? [[tile.id, tile.title] as const] : [],
    ),
  )
}

describe("an Organization's Groups, in Grants", () => {
  it('give whoever is in one exactly what the grill’s scenario gives Family, and nobody else', async () => {
    const { ana, bob, cleo, dan, design, journal, entry, garden } = await atelier()
    const group = { _tag: 'Group', id: design } as const
    const grants = [
      { tile: ana.star, subject: { _tag: 'Everyone' }, value: 'read' },
      { tile: journal.id, subject: { _tag: 'Everyone' }, value: 'none' },
      { tile: ana.star, subject: group, value: 'read' },
    ] as const
    for (const change of grants) await value(run(ana.as, Mapping.setGrant(change)))
    // Bob, in Design, reads the whole System; Cleo, a member outside it, and Dan, a stranger, what
    // Everyone reads.
    expect(await titlesSeen(bob.as, ana.star)).toEqual({
      [journal.id]: 'Journal',
      [entry.id]: 'Entry',
      [garden.id]: 'Garden',
    })
    for (const other of [cleo, dan]) {
      expect(await titlesSeen(other.as, ana.star)).toEqual({ [garden.id]: 'Garden' })
    }
    // Through his Key, as the MCP reads, Bob's Group counts as well.
    const opened = await value(
      run(request(bob.account, 'key'), Mapping.openTile({ id: entry.id, fields: ['title'] })),
    )
    expect(opened.tile).toMatchObject({ id: entry.id, title: 'Entry' })
    expect(
      await refusal(
        run(request(cleo.account, 'key'), Mapping.openTile({ id: entry.id, fields: ['title'] })),
      ),
    ).toBe('TileNotFound')
    // Ana reads it named by IAM, with its Organization's star.
    const reach = await value(run(ana.as, Mapping.whoReaches({ tile: journal.id })))
    expect(reach.others).toMatchObject([
      {
        subject: group,
        value: 'read',
        from: ana.star,
        group: { name: 'Design', organization: { title: 'Atelier' } },
      },
    ])
  })

  it('follow who is in a Group from the next request on', async () => {
    const { ana, bob, cleo, star, design, garden } = await atelier()
    const group = { _tag: 'Group', id: design } as const
    await value(run(ana.as, Mapping.setGrant({ tile: garden.id, subject: group, value: 'read' })))
    expect(Object.keys(await titlesSeen(cleo.as, ana.star))).toEqual([])
    await value(
      run(ana.as, Organizations.setInGroup({ star, group: design, member: cleo.star, in: true })),
    )
    expect(Object.keys(await titlesSeen(cleo.as, ana.star))).toEqual([garden.id])
    await value(
      run(ana.as, Organizations.setInGroup({ star, group: design, member: bob.star, in: false })),
    )
    expect(Object.keys(await titlesSeen(bob.as, ana.star))).toEqual([])
    // Leaving the Organization leaves its Groups.
    await value(run(cleo.as, Organizations.removeMember({ star, member: cleo.star })))
    expect(Object.keys(await titlesSeen(cleo.as, ana.star))).toEqual([])
  })

  it('give nobody anything once their Group is deleted, which its owner then clears', async () => {
    const { ana, bob, star, design, journal, garden } = await atelier()
    const group = { _tag: 'Group', id: design } as const
    await value(run(ana.as, Mapping.setGrant({ tile: ana.star, subject: group, value: 'read' })))
    await value(run(ana.as, Mapping.setGrant({ tile: garden.id, subject: group, value: 'none' })))
    expect(Object.keys(await titlesSeen(bob.as, ana.star))).toContain(journal.id)
    await value(run(ana.as, Organizations.deleteGroup({ star, group: design })))
    expect(await titlesSeen(bob.as, ana.star)).toEqual({})
    // The Grants are where they were, read by nobody: Journal's comes from above, and is no row; the
    // star's, set there, says its Group gone, as Garden's does.
    expect((await value(run(ana.as, Mapping.whoReaches({ tile: journal.id })))).others).toEqual([])
    const onStar = await value(run(ana.as, Mapping.whoReaches({ tile: ana.star })))
    expect(onStar.others).toMatchObject([{ subject: group, value: 'read', gone: true }])
    // Its owner clears it; setting it again is refused, its Group gone.
    await value(run(ana.as, Mapping.setGrant({ tile: ana.star, subject: group, value: 'inherit' })))
    expect((await value(run(ana.as, Mapping.whoReaches({ tile: ana.star })))).others).toEqual([])
    expect(
      await refusal(
        run(ana.as, Mapping.setGrant({ tile: ana.star, subject: group, value: 'read' })),
      ),
    ).toBe('GroupNotFound')
  })

  it('name a Group only for its Organization’s members', async () => {
    const { bob, dan, design } = await atelier()
    const group = { _tag: 'Group', id: design } as const
    // Bob, a member, names Design on his own System; Dan, a stranger, may not, nor a Group of nobody.
    await value(run(bob.as, Mapping.setGrant({ tile: bob.star, subject: group, value: 'read' })))
    for (const subject of [group, { _tag: 'Group', id: crypto.randomUUID() } as const]) {
      expect(
        await refusal(run(dan.as, Mapping.setGrant({ tile: dan.star, subject, value: 'read' }))),
      ).toBe('GroupNotFound')
    }
    const offered = await value(run(dan.as, Organizations.groupsToShareWith))
    expect(offered).toEqual([])
    const bobs = await value(run(bob.as, Organizations.groupsToShareWith))
    expect(bobs).toMatchObject([
      { star: { title: 'Atelier' }, groups: [{ id: design, name: 'Design' }] },
    ])
  })
})

describe("an Organization's Groups, named to an owner", () => {
  it('keep their names to their Organization’s members, a Grant to one still cleared', async () => {
    const { ana, bob, star, design } = await atelier()
    const group = { _tag: 'Group', id: design } as const
    await value(run(bob.as, Mapping.setGrant({ tile: bob.star, subject: group, value: 'read' })))
    const named = await value(run(bob.as, Mapping.whoReaches({ tile: bob.star })))
    expect(named.others).toMatchObject([{ subject: group, group: { name: 'Design' } }])
    // Once Bob is no longer in Atelier, his own Tile's Grant to Design shows no name, nor gone.
    await value(run(ana.as, Organizations.removeMember({ star, member: bob.star })))
    const unnamed = await value(run(bob.as, Mapping.whoReaches({ tile: bob.star })))
    expect(unnamed.others).toEqual([
      { subject: group, value: 'read', from: bob.star, star: undefined },
    ])
    expect(JSON.stringify(unnamed)).not.toContain('Design')
    await value(run(bob.as, Mapping.setGrant({ tile: bob.star, subject: group, value: 'inherit' })))
    expect((await value(run(bob.as, Mapping.whoReaches({ tile: bob.star })))).others).toEqual([])
  })
})

describe("an Organization's Groups, managed", () => {
  it('are seen with who is in them by every member, changed by its admins alone', async () => {
    const { ana, bob, cleo, dan, star, design } = await atelier()
    const listed = await value(run(cleo.as, Organizations.groups({ star })))
    expect(listed).toMatchObject([
      { id: design, name: 'Design', members: [{ star: { id: bob.star }, you: false }] },
    ])
    expect(listed[0]?.members).toHaveLength(1)
    expect((await value(run(bob.as, Organizations.groups({ star }))))[0]?.members[0]?.you).toBe(
      true,
    )
    for (const outcome of [
      run(bob.as, Organizations.createGroup({ star, name: 'Mine' })),
      run(bob.as, Organizations.renameGroup({ star, group: design, name: 'Mine' })),
      run(bob.as, Organizations.deleteGroup({ star, group: design })),
      run(bob.as, Organizations.setInGroup({ star, group: design, member: cleo.star, in: true })),
    ]) {
      expect(await refusal(outcome)).toBe('AdminRequired')
    }
    expect(await refusal(run(dan.as, Organizations.groups({ star })))).toBe('OrganizationNotFound')
    expect(
      await refusal(
        run(ana.as, Organizations.setInGroup({ star, group: design, member: dan.star, in: true })),
      ),
    ).toBe('MemberNotFound')
    expect(await refusal(run(ana.as, Organizations.createGroup({ star, name: 'design' })))).toBe(
      'GroupNameTaken',
    )
    await value(run(ana.as, Organizations.renameGroup({ star, group: design, name: ' Studio ' })))
    expect((await value(run(ana.as, Organizations.groups({ star }))))[0]?.name).toBe('Studio')
  })

  it('are managed from a Session alone, never a Key', async () => {
    const { ana, star, design } = await atelier()
    const byKey = request(ana.account, 'key')
    for (const outcome of [
      run(byKey, Organizations.createGroup({ star, name: 'Keys' })),
      run(byKey, Organizations.renameGroup({ star, group: design, name: 'Keys' })),
      run(byKey, Organizations.deleteGroup({ star, group: design })),
      run(byKey, Organizations.setInGroup({ star, group: design, member: ana.star, in: true })),
      run(byKey, Organizations.groups({ star })),
      run(byKey, Organizations.groupsToShareWith),
    ]) {
      expect(await refusal(outcome)).toBe('SessionRequired')
    }
    // A name past its bound stops at the schema, before IAM; a Group's id is a UUID.
    expect(Schema.is(NewGroup)({ star, name: 'x'.repeat(40 * 32 + 1) })).toBe(false)
    expect(Schema.is(GroupRenamed)({ star, group: 'design', name: 'Design' })).toBe(false)
  })
})
