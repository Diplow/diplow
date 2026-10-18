// The Organizations' server functions: one created, its first admin the Account its Session proves,
// with its System, whose star is born with its name; the Account's role in the Organization a star
// names; its members read by one of them; and a member added, made an admin or a member, or taken
// out, by an admin. Each from a Session alone. Each validates its input, then hands its program
// (./programs.ts) to the helper. An Organization and each member are named by their stars.
import { createServerFn } from '@tanstack/react-start'
import { Schema } from 'effect'

import { Role } from '#/domains/iam/entities'
import { contentBounds, TileId } from '#/domains/mapping/entities'

import { run } from '../../server/run'
import * as Organizations from './programs'

/** What creating an Organization sends: its name, its star's Title, bounded as a Title is. */
export const OrganizationName = Schema.Struct({
  name: Schema.String.check(Schema.isMaxLength(contentBounds.title)),
})

/** An Organization, by its star's id. */
export const OrganizationAt = Schema.Struct({ star: TileId })

/** A member of an Organization, by their star's id, in the Organization a star names. */
export const MemberAt = Schema.Struct({ star: TileId, member: TileId })

/** A member's role set, in the Organization a star names. */
export const MemberRole = Schema.Struct({ star: TileId, member: TileId, role: Role })

/** Creates an Organization, the signed-in Account its first admin: answers its star. */
export const createOrganization = createServerFn({ method: 'POST' })
  .validator(Schema.toStandardSchemaV1(OrganizationName))
  .handler(({ data, context }) => run(context, Organizations.createOrganization(data)))

/** The Account's role in the Organization a star names, none for any other star. */
export const roleIn = createServerFn({ method: 'GET' })
  .validator(Schema.toStandardSchemaV1(OrganizationAt))
  .handler(({ data, context }) => run(context, Organizations.roleIn(data)))

/** The members of the Organization a star names, each by their star and role, for its members. */
export const members = createServerFn({ method: 'GET' })
  .validator(Schema.toStandardSchemaV1(OrganizationAt))
  .handler(({ data, context }) => run(context, Organizations.members(data)))

/** Adds someone, named by their star, to the Organization a star names: its admins' alone. */
export const addMember = createServerFn({ method: 'POST' })
  .validator(Schema.toStandardSchemaV1(MemberAt))
  .handler(({ data, context }) => run(context, Organizations.addMember(data)))

/** Makes a member an admin or a member: its admins' alone, never its last admin made a member. */
export const setMemberRole = createServerFn({ method: 'POST' })
  .validator(Schema.toStandardSchemaV1(MemberRole))
  .handler(({ data, context }) => run(context, Organizations.setMemberRole(data)))

/** Takes a member out of the Organization: its admins' alone, never its last admin. */
export const removeMember = createServerFn({ method: 'POST' })
  .validator(Schema.toStandardSchemaV1(MemberAt))
  .handler(({ data, context }) => run(context, Organizations.removeMember(data)))
