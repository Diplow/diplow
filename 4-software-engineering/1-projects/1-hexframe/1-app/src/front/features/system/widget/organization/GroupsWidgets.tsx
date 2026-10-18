// An Organization's Groups, in the chat, at the conversation's foot, on ui's Groups widget, opened by
// its star's menu for each of its members (HEX-137): its Members, then each Group of its own by its
// name and who is in it; for an admin, a Group opened to be renamed, deleted, or have its members put
// in or taken out, through the Organization's members, and a new one named, then opened to be filled.
// Whether it is open, and on which star, is the URL's, a change under way as Members is (`groups`,
// `../../search/search.ts`), which `TileWidgets` draws; which Group is open, and the name typed, is
// this widget's own. IAM decides each change: a name refused shows on its field, IAM's own rule
// checked before it is sent (`groupNameOf`), any other refusal goes to its channel.
import { useState } from 'react'

import { groupNameBounds, groupNameOf } from '#/domains/iam/entities'
import {
  useCreateGroup,
  useDeleteGroup,
  useGroups,
  useMembers,
  useRenameGroup,
  useRoleIn,
  useSetInGroup,
} from '#/front/client/iam/organizations'
import { type FormErrors, submitMutation } from '#/front/client/channels'
import { toast } from '#/front/ui/atoms/Toaster'
import {
  GroupsWidget,
  GroupWidget,
} from '#/front/ui/chat/widgets/sharing/organization/GroupsWidget'
import { m } from '#/paraglide/messages'

import { groupMembersOf, groupRowsOf } from './rows'

interface GroupsWidgetsProps {
  /** The Organization's star, as the URL says. */
  star: string
  /** Its name, its star's Title. */
  title: string
  /** Closes it: the URL lets it go. */
  onClose: () => void
}

/** Which Group is open: a new one being named, one of its own by its id, or none, the list. */
type Open = 'new' | { readonly group: string } | undefined

/**
 * The Groups widget on an Organization's star, once its Groups are read, or one Group in its place
 * while an admin makes or changes it.
 */
export function GroupsWidgets({ star, title, onClose }: GroupsWidgetsProps) {
  const { data: role } = useRoleIn(star)
  const { data: groups } = useGroups(star)
  const { data: members = [] } = useMembers(star)
  const create = useCreateGroup()
  const rename = useRenameGroup()
  const remove = useDeleteGroup()
  const setIn = useSetInGroup()
  const [open, setOpen] = useState<Open>()
  const [name, setName] = useState('')
  const [refused, setRefused] = useState<string>()
  if (groups === undefined) return null
  const shown = title === '' ? m.widget_star_untitled() : title
  const manages = role === 'admin'
  const opened = typeof open === 'object' ? groups.find(({ id }) => id === open.group) : undefined
  const back = () => {
    setOpen(undefined)
    setRefused(undefined)
  }
  const openOn = (group: { readonly id: string; readonly name: string }) => {
    setOpen({ group: group.id })
    setName(group.name)
    setRefused(undefined)
  }
  /** The name, IAM's rule checked before anything is sent, or the refusal said on its field. */
  const named = () => {
    const kept = groupNameOf(name)
    if (kept === undefined) setRefused(m.error_iam_group_name_invalid())
    return kept
  }
  /** Shows a name the server refused on its field, or what else its form would show. */
  const onRefused = (errors: FormErrors | undefined) => {
    if (errors !== undefined) setRefused('fields' in errors ? errors.fields.name : errors.form)
  }
  if (manages && (open === 'new' || opened !== undefined)) {
    const sending = create.isPending || rename.isPending || remove.isPending || setIn.isPending
    return (
      <GroupWidget
        key={opened?.id ?? 'new'}
        title={shown}
        name={name}
        onNameChange={(typed) => {
          setName(typed)
          setRefused(undefined)
        }}
        refused={refused}
        nameLimit={groupNameBounds.max}
        members={opened === undefined ? undefined : groupMembersOf(members, opened)}
        sending={sending}
        onSave={() => {
          const kept = named()
          if (kept === undefined || sending) return
          if (opened === undefined) {
            const submit = submitMutation({
              mutate: create.mutateAsync,
              onSaved: ({ id }) => {
                openOn({ id, name: kept })
              },
            })
            void submit({ value: { star, name: kept } }).then(onRefused)
          } else if (kept === opened.name) {
            back()
          } else {
            const submit = submitMutation({ mutate: rename.mutateAsync, onSaved: back })
            void submit({ value: { star, group: opened.id, name: kept } }).then(onRefused)
          }
        }}
        onToggle={(member, placed) => {
          if (opened !== undefined) setIn.mutate({ star, group: opened.id, member, in: placed })
        }}
        onDelete={
          opened === undefined
            ? undefined
            : () => {
                remove.mutate(
                  { star, group: opened.id },
                  {
                    onSuccess: () => {
                      toast(m.widget_group_deleted({ name: opened.name }))
                      back()
                    },
                  },
                )
              }
        }
        onBack={back}
      />
    )
  }
  return (
    <GroupsWidget
      title={shown}
      everyone={m.widget_groups_everyone({ title: shown })}
      groups={groupRowsOf(groups)}
      manages={manages}
      onOpen={(key) => {
        const group = groups.find(({ id }) => id === key)
        if (group !== undefined) openOn(group)
      }}
      onNew={() => {
        setOpen('new')
        setName('')
        setRefused(undefined)
      }}
      onDone={onClose}
    />
  )
}
