// The Conversation records every change to the System, whoever made it: the API layer, which alone
// composes domains, subscribes to Mapping's events on the bus and hands Assistant Mapping's own
// summary of each, with who acted, as the timeline shows them: "you", a Key by its name, or the
// Assistant (`./someone/`'s `actorOf`), a change made in someone else's System said so. And a Tile
// someone shared, in the Conversation of the Account it was shared with, by
// the Title of the sharer's star. And the Account's place in an Organization changed by one of its
// admins, added, taken out, or its request to join accepted or declined, in its own Conversation, and
// a request to join in the Conversation of each of the Organization's admins (HEX-138), each by the
// Title of the acting Account's star. Wired in ../server/run.ts. The bus runs it once the write's
// transaction committed, inside the request through its `waitUntil`, and a reaction that fails is
// reported without touching the write it follows; a rolled-back write publishes nothing, so it lands
// nothing.
import { Effect, Option } from 'effect'

import * as Assistant from '#/domains/assistant/assistant'
import type { Membership } from '#/domains/assistant/entities'
import type { SignedIn } from '#/domains/iam/iam'
import { groupsNamed } from '#/domains/iam/organizations/groups'
import * as Joining from '#/domains/iam/organizations/joining'
import { MemberAdded, MemberRemoved } from '#/domains/iam/organizations/organizations'
import * as Mapping from '#/domains/mapping/mapping'
import { rightsOf } from '#/domains/mapping/entities'
import { MappingEvent } from '#/domains/mapping/operations'
import { TileShared } from '#/domains/mapping/sharing/sharing'
import { starsOf } from '#/domains/mapping/sharing/stars'
import { transactional } from '#/repositories/database/database'

import { on } from '../server/bus'
import { actingOnOwn } from '../mapping/programs'
import { actorOf } from './someone/someone'

/**
 * Records each of Mapping's events as an Entry of the Conversation of the Account that acted, as
 * Mapping summarized it on the System it changed: the Account's own, or someone else's, where the
 * envelope says it was made (`elsewhere`), the Entry then saying so, its Tiles named as the Account
 * may see them there; that owner's timeline told it already, in the write's transaction
 * (`./someone/`). An event nobody signed in made, which no door lets through, has no Conversation to
 * land in.
 */
export const recordedInConversation = on(MappingEvent, (event, actor, elsewhere) =>
  Option.match(actor, {
    onNone: () => Effect.void,
    onSome: (signedIn) =>
      Effect.gen(function* () {
        const accountId = signedIn.account.id
        const own = yield* actingOnOwn(accountId, { session: false })
        const where = Option.getOrUndefined(elsewhere)
        const summary = yield* Mapping.summary(
          where === undefined ? own : { ...own, system: where },
          event,
        )
        const actor = yield* actorOf(signedIn)
        yield* transactional(
          Assistant.recordChange(accountId, summary, actor, { elsewhere: where !== undefined }),
        )
      }),
  }),
)

/**
 * Records a Tile shared, once a Grant first opened it to an Account, as an Entry of that Account's
 * Conversation: who shared it, by the Title their star has now, the Tile by the Title it had, and
 * what the Account may do there. Only a Session shares, so nobody signed in shares nothing.
 */
export const toldShared = on(TileShared, (shared, actor) =>
  Option.match(actor, {
    onNone: () => Effect.void,
    onSome: ({ account }) =>
      Effect.gen(function* () {
        const own = yield* actingOnOwn(account.id, { session: false })
        const [star] = yield* Mapping.glimpses(own, [own.system])
        yield* transactional(
          Assistant.recordShared(shared.account, {
            by: star?.title ?? '',
            tile: { id: shared.tile, title: shared.title },
            rights: rightsOf(shared.value),
          }),
        )
      }),
  }),
)

/**
 * Some owners' stars, as a timeline names them: each by its id and the Title it has now, `''` for an
 * owner with no star yet.
 */
const starsNamed = (owners: ReadonlyArray<string>) =>
  Effect.map(starsOf(owners), (cards) =>
    owners.map((owner) => {
      const card = cards.get(owner)
      return { id: card?.id ?? '', title: card?.title ?? '' }
    }),
  )

/**
 * What a change of someone's place in an Organization names, read now: who acted, by their star's
 * Title, the Organization by its star, and the Group by its name, none for its Members.
 */
const membershipOf = (
  { account }: SignedIn,
  { organization, group }: { readonly organization: string; readonly group?: string },
) =>
  Effect.gen(function* () {
    const [by, star] = yield* starsNamed([account.id, organization])
    const name = group === undefined ? undefined : (yield* groupsNamed([group])).get(group)?.name
    return {
      by: by?.title ?? '',
      organization: star ?? { id: '', title: '' },
      ...(name !== undefined && { group: name }),
    }
  })

/** Records what an admin did to an Account's place in an Organization, in that Account's Conversation. */
const toldMembership = (
  accountId: string,
  what: Membership['what'],
  told: { readonly organization: string; readonly group?: string },
  signedIn: SignedIn,
) =>
  Effect.flatMap(membershipOf(signedIn, told), (named) =>
    transactional(Assistant.recordMembership(accountId, { what, ...named })),
  )

/** Records an Account added to an Organization by an admin, in its own Conversation. */
export const toldAdded = on(MemberAdded, (added, actor) =>
  Option.match(actor, {
    onNone: () => Effect.void,
    onSome: (signedIn) => toldMembership(added.account, 'added', added, signedIn),
  }),
)

/**
 * Records an Account taken out of an Organization by an admin, in its own Conversation; nothing for
 * one that left, which it did itself.
 */
export const toldRemoved = on(MemberRemoved, (removed, actor) =>
  Option.match(actor, {
    onNone: () => Effect.void,
    onSome: (signedIn) =>
      signedIn.account.id === removed.account
        ? Effect.void
        : toldMembership(removed.account, 'removed', removed, signedIn),
  }),
)

/** Records a request to join decided, in the Conversation of whoever asked. */
export const toldDecided = on(Joining.JoinDecided, (decided, actor) =>
  Option.match(actor, {
    onNone: () => Effect.void,
    onSome: (signedIn) =>
      toldMembership(
        decided.account,
        decided.accepted ? 'accepted' : 'declined',
        decided,
        signedIn,
      ),
  }),
)

/**
 * Records a request to join in the Conversation of each of the Organization's admins now, each in a
 * transaction of its own, so a request never holds two Conversations' locks at once: who asked, by
 * their star's Title, the Organization, the Group, and the request, which they accept or decline.
 */
export const toldAsked = on(Joining.JoinAsked, (asked, actor) =>
  Option.match(actor, {
    onNone: () => Effect.void,
    onSome: (signedIn) =>
      Effect.gen(function* () {
        const named = yield* membershipOf(signedIn, asked)
        const admins = yield* Joining.adminsOf(asked.organization)
        yield* Effect.forEach(admins, (admin) =>
          transactional(Assistant.recordJoinAsked(admin, { request: asked.request, ...named })),
        )
      }),
  }),
)
