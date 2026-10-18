// Organizations on the client, over their server functions (src/api/iam/organizations/): one made,
// the Account's role in the Organization a star names, read as one query by the star, its members,
// read as one by the star, and each change of them, which reads both again once it settles, failed
// or not, and the System visited too, whose rights a role changes; and its Groups of their own, read
// as one query by the star, each change of them reading them again, every System and who reaches a
// Tile too, since who is in a Group changes what they read, and the Groups the Account may name in a
// Grant (HEX-137). Each from a Session alone: a refusal goes to its channel (../channels.ts), and a
// hook's caller handles none, but for a Group's name, a form's, refused on its field.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  addMember,
  createOrganization,
  type MemberAt,
  type MemberRole,
  members,
  roleIn,
  removeMember,
  setMemberRole,
} from '#/api/iam/organizations/organizations'
import {
  createGroup,
  deleteGroup,
  type GroupAt,
  type GroupMember,
  type GroupRenamed,
  groups,
  groupsToShareWith,
  type NewGroup,
  renameGroup,
  setInGroup,
} from '#/api/iam/organizations/groups'

import { read, write } from '../calls'

/** The Account's role in an Organization, by the server function's name. */
const roleScope = 'roleIn'

/** An Organization's members, by the server function's name. */
const membersScope = 'members'

/**
 * The Account's role in the Organization a star names, `admin` or `member`, none for a star of no
 * Organization of its: what offers the star's Members widget.
 */
export const useRoleIn = (star: string | undefined) =>
  useQuery({
    ...read({
      scope: roleScope,
      key: [star],
      call: () => roleIn({ data: { star: star ?? '' } }),
    }),
    enabled: star !== undefined,
    // A menu line hangs on it: a failure leaves it out rather than taking the canvas's boundary.
    throwOnError: false,
  })

/**
 * The members of the Organization a star names, the earliest first, each by their star's card. A
 * failure throws nothing: once the user left, or for a star of no Organization of theirs, the
 * widget shows nothing rather than the chat's boundary.
 */
export const useMembers = (star: string) =>
  useQuery({
    ...read({ scope: membersScope, key: [star], call: () => members({ data: { star } }) }),
    throwOnError: false,
  })

/** One member, as the Members widget lists them: their star's card, their role, whether it is you. */
export type Member = NonNullable<ReturnType<typeof useMembers>['data']>[number]

/**
 * After a change of who belongs where: the roles, the members, the Groups, which a member taken out
 * leaves, and every System read again.
 */
const readAgain = (client: ReturnType<typeof useQueryClient>) =>
  Promise.all([
    client.invalidateQueries({ queryKey: [roleScope] }),
    client.invalidateQueries({ queryKey: [membersScope] }),
    client.invalidateQueries({ queryKey: ['groups'] }),
    client.invalidateQueries({ queryKey: ['groupsToShareWith'] }),
    client.invalidateQueries({ queryKey: ['system'] }),
  ])

/** Adds someone, by their star, to the Organization a star names. */
export const useAddMember = () => {
  const client = useQueryClient()
  return useMutation({
    ...write('addMember', (data: typeof MemberAt.Type) => addMember({ data })),
    onSettled: () => readAgain(client),
  })
}

/** Makes a member an admin, or an admin a member. */
export const useSetMemberRole = () => {
  const client = useQueryClient()
  return useMutation({
    ...write('setMemberRole', (data: typeof MemberRole.Type) => setMemberRole({ data })),
    onSettled: () => readAgain(client),
  })
}

/** Takes a member out of the Organization, the user themselves included. */
export const useRemoveMember = () => {
  const client = useQueryClient()
  return useMutation({
    ...write('removeMember', (data: typeof MemberAt.Type) => removeMember({ data })),
    onSettled: () => readAgain(client),
  })
}

/** Creates an Organization, the Account its first admin: answers its star, which it is visited by. */
export const useCreateOrganization = () =>
  useMutation(write('createOrganization', (name: string) => createOrganization({ data: { name } })))

/** An Organization's Groups, by the server function's name. */
const groupsScope = 'groups'

/** The Groups the Account may name in a Grant, by the server function's name. */
const shareableScope = 'groupsToShareWith'

/**
 * The Groups of the Organization a star names, the earliest first, each with who is in it by their
 * stars' cards. A failure throws nothing, as the members' read: the widget then shows nothing.
 */
export const useGroups = (star: string) =>
  useQuery({
    ...read({ scope: groupsScope, key: [star], call: () => groups({ data: { star } }) }),
    throwOnError: false,
  })

/** One of an Organization's Groups, as the Groups widget lists it. */
export type Group = NonNullable<ReturnType<typeof useGroups>['data']>[number]

/**
 * The Groups the Account may name in a Grant, by the Organizations it belongs to, each by its star's
 * card. A failure throws nothing: the Share widget then offers no group.
 */
export const useGroupsToShareWith = () =>
  useQuery({
    ...read({ scope: shareableScope, key: [], call: () => groupsToShareWith({ data: undefined }) }),
    throwOnError: false,
  })

/** The Groups the Account may name in a Grant, by Organization, as the Share widget offers them. */
export type ShareableGroups = NonNullable<ReturnType<typeof useGroupsToShareWith>['data']>

/**
 * After a change of an Organization's Groups: its Groups, those the Account may name, who reaches a
 * Tile, which names them, and every System, which who is in one changes, read again.
 */
const groupsAgain = (client: ReturnType<typeof useQueryClient>) =>
  Promise.all([
    client.invalidateQueries({ queryKey: [groupsScope] }),
    client.invalidateQueries({ queryKey: [shareableScope] }),
    client.invalidateQueries({ queryKey: ['whoReaches'] }),
    client.invalidateQueries({ queryKey: ['system'] }),
  ])

/** Makes a Group, a form's submit, its name refused on its field: answers its id. */
export const useCreateGroup = () => {
  const client = useQueryClient()
  return useMutation({
    ...write('createGroup', (data: typeof NewGroup.Type) => createGroup({ data }), {
      as: 'submit',
    }),
    onSettled: () => groupsAgain(client),
  })
}

/** Renames a Group, a form's submit, its name refused on its field. */
export const useRenameGroup = () => {
  const client = useQueryClient()
  return useMutation({
    ...write('renameGroup', (data: typeof GroupRenamed.Type) => renameGroup({ data }), {
      as: 'submit',
    }),
    onSettled: () => groupsAgain(client),
  })
}

/** Deletes a Group: its Grants then reach nobody. */
export const useDeleteGroup = () => {
  const client = useQueryClient()
  return useMutation({
    ...write('deleteGroup', (data: typeof GroupAt.Type) => deleteGroup({ data })),
    onSettled: () => groupsAgain(client),
  })
}

/** Puts a member in a Group, or takes them out. */
export const useSetInGroup = () => {
  const client = useQueryClient()
  return useMutation({
    ...write('setInGroup', (data: typeof GroupMember.Type) => setInGroup({ data })),
    onSettled: () => groupsAgain(client),
  })
}
