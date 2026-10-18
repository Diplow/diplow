// Who belongs to an Organization, in the chat, at the conversation's foot, on ui's Members widget,
// opened by its star's menu for each of its members (HEX-136): each member by their star and their
// role; for an admin, a role set, a member taken out, themselves included, and someone added through
// the star picker, by their star, a member. Whether it is open, and on which star, is the URL's, a
// change under way as Share is (`members`, `../../search/search.ts`), which `TileWidgets` draws;
// whether the star picker shows in its place, and what is typed there, is this widget's own. IAM
// decides each change, its last admin kept; a refusal goes to its channel.
import { useState } from 'react'

import {
  useAddMember,
  useMembers,
  useRemoveMember,
  useRoleIn,
  useSetMemberRole,
} from '#/front/client/iam/organizations'
import { useStarsFor } from '#/front/client/mapping/sharing'
import { MembersWidget } from '#/front/ui/chat/widgets/sharing/organization/MembersWidget'
import { StarPicker } from '#/front/ui/chat/widgets/sharing/star-picker/StarPicker'
import { m } from '#/paraglide/messages'

import { isMember, memberRowsOf, starOfRow } from './rows'

interface MembersWidgetsProps {
  /** The Organization's star, as the URL says. */
  star: string
  /** Its name, its star's Title. */
  title: string
  /** Closes it: the URL lets it go. */
  onClose: () => void
}

/**
 * The Members widget on an Organization's star, once its members are read, or the star picker in
 * its place while someone is being added; managed by its admins, read by its members.
 */
export function MembersWidgets({ star, title, onClose }: MembersWidgetsProps) {
  const { data: role } = useRoleIn(star)
  const { data: members } = useMembers(star)
  const add = useAddMember()
  const setRole = useSetMemberRole()
  const remove = useRemoveMember()
  const [picking, setPicking] = useState(false)
  const [typed, setTyped] = useState('')
  const found = useStarsFor(typed, location.href)
  if (members === undefined) return null
  const shown = title === '' ? m.widget_star_untitled() : title
  if (picking) {
    const back = () => {
      setPicking(false)
      setTyped('')
    }
    return (
      <StarPicker
        title={m.widget_members_add_whom({ title: shown })}
        typed={typed}
        onType={setTyped}
        found={found}
        onPick={(picked) => {
          if (!isMember(members, picked.id)) add.mutate({ star, member: picked.id })
          back()
        }}
        onCancel={back}
        takesFocus
      />
    )
  }
  return (
    <MembersWidget
      title={shown}
      members={memberRowsOf(members)}
      manages={role === 'admin'}
      sending={add.isPending || setRole.isPending || remove.isPending}
      onRole={(key, next) => {
        const member = starOfRow(key)
        if (member !== undefined) setRole.mutate({ star, member, role: next })
      }}
      onRemove={(key) => {
        const member = starOfRow(key)
        if (member !== undefined) remove.mutate({ star, member })
      }}
      onAdd={() => {
        setPicking(true)
      }}
      onDone={onClose}
    />
  )
}
