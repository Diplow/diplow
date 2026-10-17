// Rights on a Tile, and the Grants they come from. A Tile carries a Grant for any number of subjects,
// an Account, a Group or Everyone; a subject without one inherits its parent's value, and a star, which
// has no parent, gives none. What an actor may do on a Tile is, for each subject covering them, the
// nearest explicit value walking up, then the union of those; its owner may do everything. Pure: the
// API layer says who the actor is, the tiles repository keeps the Grants, Mapping decides here.
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

/** A Grant's value for its subject: `none`, or the rights it gives, `read` always among them. */
export const GrantValue = Schema.Literals(['none', 'read', 'read+write', 'read+@', 'read+write+@'])
export type GrantValue = typeof GrantValue.Type

/** The rights each value gives. */
const given: Readonly<Record<GrantValue, ReadonlyArray<Right>>> = {
  none: [],
  read: ['read'],
  'read+write': ['read', 'write'],
  'read+@': ['read', '@'],
  'read+write+@': ['read', 'write', '@'],
}

/** An Account or a Group a Grant is for, by an id opaque to Mapping: IAM's to say who it is. */
const Named = Schema.Union([
  Schema.TaggedStruct('Account', { id: Schema.String }),
  Schema.TaggedStruct('Group', { id: Schema.String }),
])

/** Anyone holding the link to a Tile, signed in or not. */
const Everyone = Schema.TaggedStruct('Everyone', {})

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
  readonly value: string
}

const decodeGrant = Schema.decodeUnknownOption(Grant)

/** The subject a row's kind and id name, none for a kind that needs an id and has none. */
function subjectOf({ subject, subjectId }: GrantRow): Subject | undefined {
  if (subject === 'everyone') return { _tag: 'Everyone' }
  if (subjectId === null) return undefined
  return { _tag: subject === 'account' ? 'Account' : 'Group', id: subjectId }
}

/**
 * The Grant a row keeps, none for a row that is no Grant, Everyone given more than `read` among
 * them: such a row resolves for nobody.
 */
export function grantOf(row: GrantRow): Grant | undefined {
  const subject = subjectOf(row)
  if (subject === undefined) return undefined
  return Option.getOrUndefined(decodeGrant({ tile: row.tile, subject, value: row.value }))
}

/**
 * Who acts, as Mapping reads them, handed over by the API layer fresh for every request, never
 * cached: their Account; the Groups they belong to; the owners they stand for, their own Account and,
 * later, the Organizations they are an admin of; and whether a Session proves the request, rather than
 * a Key, a Turn's Key or an agent. Every id is opaque to Mapping.
 */
export interface Actor {
  readonly account: string
  readonly groups: ReadonlyArray<string>
  readonly owners: ReadonlyArray<string>
  readonly session: boolean
}

/** Whether the actor stands for this owner, and so has every right on its System's Tiles. */
export const owns = (actor: Actor, owner: string) => actor.owners.includes(owner)

/** The subjects covering an actor: their Account, each of their Groups, and Everyone. */
export const subjectsOf = (actor: Actor): ReadonlyArray<Subject> => [
  { _tag: 'Account', id: actor.account },
  ...actor.groups.map((id): Subject => ({ _tag: 'Group', id })),
  { _tag: 'Everyone' },
]

/** One subject's key, the same for two equal subjects. */
const keyOf = (subject: Subject) =>
  subject._tag === 'Everyone' ? 'Everyone' : `${subject._tag}:${subject.id}`

/** Where each Tile and Reference of a System stands, as rights read it: its parent's id, `null` for the star. */
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
    held.set(keyOf(subject), value)
    byTile.set(tile, held)
    subjects.set(keyOf(subject), subject)
  }
  return { owner, lineage, grants: byTile, subjects: [...subjects.values()] }
}

/**
 * The value a subject has on a Tile: the nearest explicit one walking up from it, `none` at the star,
 * which inherits nothing, and `none` for an id the System doesn't hold.
 */
export function valueOn(sharing: Sharing, subject: Subject, tile: string): GrantValue {
  const key = keyOf(subject)
  let at: string | null | undefined = tile
  while (at !== null && at !== undefined) {
    const explicit = sharing.grants.get(at)?.get(key)
    if (explicit !== undefined) return explicit
    at = sharing.lineage.get(at)
  }
  return 'none'
}

/** The rights a subject has on a Tile, Everyone's never more than `read`. */
const rightsOf = (sharing: Sharing, subject: Subject, tile: string): ReadonlyArray<Right> => {
  const rights = given[valueOn(sharing, subject, tile)]
  return subject._tag === 'Everyone' ? rights.filter((right) => right === 'read') : rights
}

/** Whether a subject reads a Tile: what a move must not widen. */
export const reads = (sharing: Sharing, subject: Subject, tile: string) =>
  rightsOf(sharing, subject, tile).includes('read')

/**
 * The rights an actor has on a Tile of a System: every one when they stand for its owner, else the
 * union of what each subject covering them has there. None on an id the System doesn't hold.
 */
export function rightsOn(actor: Actor, sharing: Sharing, tile: string): ReadonlySet<Right> {
  if (!sharing.lineage.has(tile)) return new Set()
  if (owns(actor, sharing.owner)) return new Set(Right.literals)
  return new Set(subjectsOf(actor).flatMap((subject) => rightsOf(sharing, subject, tile)))
}
