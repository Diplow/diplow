// Rights on a Tile, and the Grants they come from. A Tile carries a Grant for any number of subjects,
// an Account, a Group or Everyone; a subject without one inherits its parent's value, and a star, which
// has no parent, gives none. What an actor may do on a Tile is, for each subject covering them, the
// nearest explicit value walking up, then the union of those; its owner may do everything. Everyone
// reads at most: a Grant giving it more is none. Pure: the API layer says who the actor is, the tiles
// repository keeps the Grants, Mapping decides here.
import { Option, Schema } from 'effect'

import type { Row } from '../rows'
import type { System } from '../system'

/**
 * What someone may do on a Tile: `read` it; `write` it, which includes reading it; and `@`, run the
 * agent at it, which includes reading it too. `write` and `@` are independent: an `@` without `write`
 * writes nothing.
 */
export const Right = Schema.Literals(['read', 'write', '@'])
export type Right = typeof Right.Type

/** A value that lets its subject read: every one but `none`, `read` always among the rights it gives. */
export const Reading = Schema.Literals(['read', 'read+write', 'read+@', 'read+write+@'])
export type Reading = typeof Reading.Type

/** A Grant's value for its subject: `none`, or the rights it gives, `read` always among them. */
export const GrantValue = Schema.Literals(['none', ...Reading.literals])
export type GrantValue = typeof GrantValue.Type

/** The rights each value gives. */
const given: Readonly<Record<GrantValue, ReadonlyArray<Right>>> = {
  none: [],
  read: ['read'],
  'read+write': ['read', 'write'],
  'read+@': ['read', '@'],
  'read+write+@': ['read', 'write', '@'],
}

/** The rights a value gives, `read` first: none for `none`. */
export const rightsOf = (value: GrantValue): ReadonlyArray<Right> => given[value]

/** An Account or a Group a Grant is for, by an id opaque to Mapping: IAM's to say who it is. */
const Named = Schema.Union([
  Schema.TaggedStruct('Account', { id: Schema.String }),
  Schema.TaggedStruct('Group', { id: Schema.String }),
])

/** Anyone holding the link to a Tile, signed in or not. */
export const Everyone = Schema.TaggedStruct('Everyone', {})

/** Who a Grant is for: an Account, a Group, or Everyone. */
export type Subject = typeof Named.Type | typeof Everyone.Type

/**
 * A Tile's value for one subject, explicit, where every other subject inherits. Everyone reads at
 * most: a Grant giving it `write` or `@` is no Grant, and refused as one.
 */
export const Grant = Schema.Union([
  Schema.Struct({ tile: Schema.String, subject: Named, value: GrantValue }),
  Schema.Struct({
    tile: Schema.String,
    subject: Everyone,
    value: Schema.Literals(['none', 'read']),
  }),
])
export type Grant = typeof Grant.Type

/**
 * A Grant as the tiles repository keeps it, a row: the Tile's id, the subject's kind and its id, none
 * for Everyone, and the value. Mapping declares it, and the repository's rows satisfy it.
 */
export interface GrantRow {
  readonly tile: string
  readonly subject: 'account' | 'group' | 'everyone'
  readonly subjectId: string | null
  readonly value: GrantValue
}

const decodeGrant = Schema.decodeUnknownOption(Grant)

/** The subject a row's kind and id name, none for a kind that needs an id and has none. */
function subjectOf({ subject, subjectId }: GrantRow): Subject | undefined {
  if (subject === 'everyone') return { _tag: 'Everyone' }
  if (subjectId === null) return undefined
  return { _tag: subject === 'account' ? 'Account' : 'Group', id: subjectId }
}

/** A subject as a row names it, the inverse of `subjectOf`: its kind, and its id, none for Everyone. */
export const subjectRowOf = (subject: Subject): Pick<GrantRow, 'subject' | 'subjectId'> =>
  subject._tag === 'Everyone'
    ? { subject: 'everyone', subjectId: null }
    : { subject: subject._tag === 'Account' ? 'account' : 'group', subjectId: subject.id }

/**
 * The Grant a row keeps, none for a row that is no Grant, Everyone given more than `read` or an
 * Account or a Group without an id: such a row resolves for nobody.
 */
export function grantOf(row: GrantRow): Grant | undefined {
  const subject = subjectOf(row)
  if (subject === undefined) return undefined
  return Option.getOrUndefined(decodeGrant({ tile: row.tile, subject, value: row.value }))
}

/**
 * Who acts, as Mapping reads them, handed over by the API layer fresh for every request, never
 * cached: their Account, none for anyone a request proves nothing of (`anyone`); the Groups they
 * belong to; the owners they stand for, their own Account and, later, the Organizations they are an
 * admin of; and whether the change is the user's own, made from a Session, rather than a Key's, a
 * Turn's Key's or an agent's, an accepted Proposal's included until its writes are the user's
 * (HEX-135). Every id is opaque to Mapping.
 */
export interface Actor {
  readonly account: string | undefined
  readonly groups: ReadonlyArray<string>
  readonly owners: ReadonlyArray<string>
  readonly session: boolean
}

/**
 * Anyone holding the link to a Tile, signed in or not, the request proving no Account: an actor
 * Everyone alone covers, in no Group, standing for no owner, acting from no Session. What a public
 * Tile is read as (HEX-129).
 */
export const anyone: Actor = { account: undefined, groups: [], owners: [], session: false }

/** Whether the actor stands for this owner, and so has every right on its System's Tiles. */
export const owns = (actor: Actor, owner: string) => actor.owners.includes(owner)

/** The subjects covering an actor: their Account, if any, each of their Groups, and Everyone. */
const subjectsOf = (actor: Actor): ReadonlyArray<Subject> => [
  ...(actor.account === undefined ? [] : [{ _tag: 'Account', id: actor.account } as const]),
  ...actor.groups.map((id): Subject => ({ _tag: 'Group', id })),
  { _tag: 'Everyone' },
]

/** One subject's key, the same for two equal subjects: what the front keys a subject's row by too. */
export const subjectKeyOf = (subject: Subject) =>
  subject._tag === 'Everyone' ? 'Everyone' : `${subject._tag}:${subject.id}`

/**
 * Where each Tile and Reference of a System stands, as rights read it: its parent's id, `null` for
 * the star.
 */
export type Lineage = ReadonlyMap<string, string | null>

/** The lineage of a System's rows. */
export const lineageFrom = (rows: ReadonlyArray<Pick<Row, 'id' | 'parentId'>>): Lineage =>
  new Map(rows.map(({ id, parentId }) => [id, parentId]))

/** The lineage of a flat System. */
export const lineageOf = (system: System): Lineage =>
  new Map([
    [system.root.id, null],
    ...Object.values(system.tiles).map((held) => [held.id, held.parent] as const),
  ])

/**
 * A System as its rights are read: its owner, where each of its Tiles stands, and the Grants its
 * Tiles carry, each by its Tile and its subject.
 */
export interface Sharing {
  readonly owner: string
  readonly lineage: Lineage
  readonly grants: ReadonlyMap<string, ReadonlyMap<string, GrantValue>>
  /** Every subject the Grants name, and Everyone: those who may read any of its Tiles. */
  readonly subjects: ReadonlyArray<Subject>
}

/** How a System is shared: its owner, its lineage and its Grants, indexed for the walks up. */
export function sharingOf(owner: string, lineage: Lineage, grants: ReadonlyArray<Grant>): Sharing {
  const byTile = new Map<string, Map<string, GrantValue>>()
  const subjects = new Map<string, Subject>([['Everyone', { _tag: 'Everyone' }]])
  for (const { tile, subject, value } of grants) {
    const held = byTile.get(tile) ?? new Map<string, GrantValue>()
    held.set(subjectKeyOf(subject), value)
    byTile.set(tile, held)
    subjects.set(subjectKeyOf(subject), subject)
  }
  return { owner, lineage, grants: byTile, subjects: [...subjects.values()] }
}

/**
 * The value a subject has on a Tile, and the Tile whose Grant gives it: the nearest explicit one
 * walking up from it; `none` from nowhere at the star, which inherits nothing, for an id the System
 * doesn't hold, or for a walk that comes back to a Tile it passed, which no System holds.
 */
export function originOn(
  sharing: Sharing,
  subject: Subject,
  tile: string,
): { readonly value: GrantValue; readonly from: string | null } {
  const key = subjectKeyOf(subject)
  const passed = new Set<string>()
  let at: string | null | undefined = tile
  while (at !== null && at !== undefined && !passed.has(at)) {
    const explicit = sharing.grants.get(at)?.get(key)
    if (explicit !== undefined) return { value: explicit, from: at }
    passed.add(at)
    at = sharing.lineage.get(at)
  }
  return { value: 'none', from: null }
}

/** The value a subject has on a Tile: the nearest explicit one walking up from it (`originOn`). */
export const valueOn = (sharing: Sharing, subject: Subject, tile: string): GrantValue =>
  originOn(sharing, subject, tile).value

/** The rights a subject holds on a Tile: what the value it has there gives. */
export const heldBy = (sharing: Sharing, subject: Subject, tile: string): ReadonlyArray<Right> =>
  given[valueOn(sharing, subject, tile)]

/**
 * The rights an actor has on a Tile of a System: every one when they stand for its owner, else the
 * union of what each subject covering them holds there. None on an id the System doesn't hold.
 */
export function rightsOn(actor: Actor, sharing: Sharing, tile: string): ReadonlySet<Right> {
  if (!sharing.lineage.has(tile)) return new Set()
  if (owns(actor, sharing.owner)) return new Set(Right.literals)
  return new Set(subjectsOf(actor).flatMap((subject) => heldBy(sharing, subject, tile)))
}
