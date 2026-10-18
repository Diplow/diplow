// Organizations on the client, over their server functions (src/api/iam/organizations/): one made,
// the Account's role in the Organization a star names, read as one query by the star, its members,
// read as one by the star, and each change of them, which reads both again once it settles, failed
// or not, and the System visited too, whose rights a role changes. Each from a Session alone: a
// refusal goes to its channel (../channels.ts), and a hook's caller handles none.
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
  })

/** The members of the Organization a star names, the earliest first, each by their star's card. */
export const useMembers = (star: string) =>
  useQuery(read({ scope: membersScope, key: [star], call: () => members({ data: { star } }) }))

/** One member, as the Members widget lists them: their star's card, their role, whether it is you. */
export type Member = NonNullable<ReturnType<typeof useMembers>['data']>[number]

/** After a change of who belongs where: the roles, the members and every System read again. */
const readAgain = (client: ReturnType<typeof useQueryClient>) =>
  Promise.all([
    client.invalidateQueries({ queryKey: [roleScope] }),
    client.invalidateQueries({ queryKey: [membersScope] }),
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
