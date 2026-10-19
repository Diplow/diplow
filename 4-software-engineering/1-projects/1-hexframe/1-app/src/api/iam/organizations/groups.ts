// The Groups' server functions (HEX-137): an Organization's Groups of its own, read with who is in
// each by its members, and made, renamed, deleted and filled by its admins; and the Groups the
// Account may name in a Grant, which the Share widget offers. Each from a Session alone. Each
// validates its input, then hands its program (./programs.ts) to the helper. An Organization and each
// member are named by their stars, a Group by its id, IAM's, a Group having no star.
import { createServerFn } from '@tanstack/react-start'
import { Schema } from 'effect'

import { GroupId, groupNameBounds } from '#/domains/iam/entities'
import { TileId } from '#/domains/mapping/entities'

import { run } from '../../server/run'
import { nameOnTheWire } from '../names'
import * as Organizations from './programs'

/** A Group's name as it is sent, bounded before IAM counts it (`nameOnTheWire`). */
const GroupName = nameOnTheWire(groupNameBounds.max)

/** An Organization, by its star's id. */
const OrganizationAt = Schema.Struct({ star: TileId })

/** A Group made in the Organization a star names, by its name. */
export const NewGroup = Schema.Struct({ star: TileId, name: GroupName })

/** One of the Organization's Groups, by its id. */
export const GroupAt = Schema.Struct({ star: TileId, group: GroupId })

/** One of the Organization's Groups renamed. */
export const GroupRenamed = Schema.Struct({ star: TileId, group: GroupId, name: GroupName })

/** A member, by their star, put in one of the Organization's Groups, or taken out. */
export const GroupMember = Schema.Struct({
  star: TileId,
  group: GroupId,
  member: TileId,
  in: Schema.Boolean,
})

/** The Groups of the Organization a star names, each with who is in it, for its members. */
export const groups = createServerFn({ method: 'GET' })
  .validator(Schema.toStandardSchemaV1(OrganizationAt))
  .handler(({ data, context }) => run(context, Organizations.groups(data)))

/** Makes a Group in the Organization a star names: its admins' alone. Answers its id. */
export const createGroup = createServerFn({ method: 'POST' })
  .validator(Schema.toStandardSchemaV1(NewGroup))
  .handler(({ data, context }) => run(context, Organizations.createGroup(data)))

/** Renames one of the Organization's Groups: its admins' alone. */
export const renameGroup = createServerFn({ method: 'POST' })
  .validator(Schema.toStandardSchemaV1(GroupRenamed))
  .handler(({ data, context }) => run(context, Organizations.renameGroup(data)))

/** Deletes one of the Organization's Groups: its admins' alone; its Grants then reach nobody. */
export const deleteGroup = createServerFn({ method: 'POST' })
  .validator(Schema.toStandardSchemaV1(GroupAt))
  .handler(({ data, context }) => run(context, Organizations.deleteGroup(data)))

/** Puts a member in one of the Organization's Groups, or takes them out: its admins' alone. */
export const setInGroup = createServerFn({ method: 'POST' })
  .validator(Schema.toStandardSchemaV1(GroupMember))
  .handler(({ data, context }) => run(context, Organizations.setInGroup(data)))

/** The Groups the Account may name in a Grant, by the Organizations it belongs to. */
export const groupsToShareWith = createServerFn({ method: 'GET' })
  .validator(Schema.toStandardSchemaV1(Schema.Undefined))
  .handler(({ context }) => run(context, Organizations.groupsToShareWith))
