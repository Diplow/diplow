// The Organization widgets on /design-system, live on samples: an Organization named, refused while
// its name is blank, made in a toast, and on a phone; its members, as an admin manages them, as a
// member reads them, and on a phone; and its groups (HEX-137), as an admin makes, renames, fills and
// deletes them, as a member reads them, and on a phone. Nothing reaches IAM: what home would change,
// and the star picker it would open to add someone, show in a toast, and the rows follow each change
// as IAM would answer it, its last admin kept, a group's name refused as IAM refuses it.
import { useState } from 'react'

import { m } from '#/paraglide/messages'

import { toast } from '../../../../atoms/Toaster'
import { GalleryColumn, GallerySection, GalleryState } from '../../../../gallery/frame'
import { said } from '../../../samples'
import { type GroupRow, GroupsWidget, GroupWidget } from './GroupsWidget'
import { type MemberRole, type MemberRow, MembersWidget } from './MembersWidget'
import { OrganizationWidget } from './OrganizationWidget'

export function OrganizationWidgetGallery() {
  return (
    <GallerySection name="OrganizationWidget">
      <GalleryState label={m.gallery_state_organization_live()}>
        <GalleryColumn>
          <LiveOrganization />
        </GalleryColumn>
      </GalleryState>
      <GalleryState label={m.gallery_state_widget_phone()}>
        <GalleryColumn phone>
          <LiveOrganization />
        </GalleryColumn>
      </GalleryState>
    </GallerySection>
  )
}

export function MembersWidgetGallery() {
  return (
    <GallerySection name="MembersWidget">
      <GalleryState label={m.gallery_state_members_admin()}>
        <GalleryColumn>
          <LiveMembers manages />
        </GalleryColumn>
      </GalleryState>
      <GalleryState label={m.gallery_state_members_member()}>
        <GalleryColumn>
          <LiveMembers manages={false} />
        </GalleryColumn>
      </GalleryState>
      <GalleryState label={m.gallery_state_widget_phone()}>
        <GalleryColumn phone>
          <LiveMembers manages />
        </GalleryColumn>
      </GalleryState>
    </GallerySection>
  )
}

/** A sample Organization's name, a star's Title, which is no word to translate. */
const sampleName = 'Atelier'

function LiveOrganization() {
  const [name, setName] = useState('')
  const [refused, setRefused] = useState<string>()
  return (
    <OrganizationWidget
      name={name}
      onNameChange={(typed) => {
        setName(typed)
        setRefused(undefined)
      }}
      refused={refused}
      onCreate={() => {
        if (name.trim() === '') setRefused(m.widget_organization_name_missing())
        else toast(m.gallery_organization_made({ name: name.trim() }))
      }}
      onLater={said(m.widget_organization_later())}
    />
  )
}

/** The sample members: you, its admin; Bob, a member; Cleo, an admin too. */
const sampleMembers: readonly MemberRow[] = [
  { key: 'ana', who: 'Ana Lima', role: 'admin', you: true },
  { key: 'bob', who: 'Bob Martin', role: 'member', you: false },
  { key: 'cleo', who: 'Cleo Diaz', role: 'member', you: false },
]

/** Whether a change leaves the Organization without an admin, which IAM refuses. */
const leavesNoAdmin = (rows: readonly MemberRow[]) => rows.every((row) => row.role !== 'admin')

function LiveMembers({ manages }: { manages: boolean }) {
  const [rows, setRows] = useState(sampleMembers)
  const changed = (next: readonly MemberRow[], told: string) => {
    if (leavesNoAdmin(next)) {
      toast(m.error_iam_last_admin())
      return
    }
    setRows(next)
    toast(told)
  }
  return (
    <MembersWidget
      title={sampleName}
      members={rows}
      manages={manages}
      onRole={(key, role: MemberRole) => {
        const next = rows.map((row) => (row.key === key ? { ...row, role } : row))
        const who = rows.find((row) => row.key === key)?.who ?? ''
        changed(
          next,
          m.gallery_members_role({
            who,
            role: role === 'admin' ? m.widget_members_admin() : m.widget_members_member(),
          }),
        )
      }}
      onRemove={(key) => {
        const who = rows.find((row) => row.key === key)?.who ?? ''
        changed(
          rows.filter((row) => row.key !== key),
          m.gallery_members_removed({ who }),
        )
      }}
      onAdd={said(m.gallery_members_add())}
      onDone={() => {
        setRows(sampleMembers)
      }}
    />
  )
}

interface GroupsWidgetGalleryProps {
  /** IAM's rule for a group's name, which the route reads at IAM's door and hands over. */
  nameOf: (name: string) => string | undefined
  /** The most characters a name holds. */
  nameLimit: number
}

export function GroupsWidgetGallery({ nameOf, nameLimit }: GroupsWidgetGalleryProps) {
  const rule = { nameOf, nameLimit }
  return (
    <GallerySection name="GroupsWidget">
      <GalleryState label={m.gallery_state_groups_admin()}>
        <GalleryColumn>
          <LiveGroups manages {...rule} />
        </GalleryColumn>
      </GalleryState>
      <GalleryState label={m.gallery_state_groups_member()}>
        <GalleryColumn>
          <LiveGroups manages={false} {...rule} />
        </GalleryColumn>
      </GalleryState>
      <GalleryState label={m.gallery_state_widget_phone()}>
        <GalleryColumn phone>
          <LiveGroups manages {...rule} />
        </GalleryColumn>
      </GalleryState>
    </GallerySection>
  )
}

/** A sample group: its name and who is in it, by their keys among the sample members. */
interface SampleGroup {
  readonly key: string
  readonly name: string
  readonly members: readonly string[]
}

/** The sample groups: Design, with you and Cleo; Ops, nobody yet. */
const sampleGroups: readonly SampleGroup[] = [
  { key: 'design', name: 'Design', members: ['ana', 'cleo'] },
  { key: 'ops', name: 'Ops', members: [] },
]

/** A sample member by their key, as the rows name them, you marked. */
const whoIs = (key: string) => {
  const member = sampleMembers.find((row) => row.key === key)
  if (member === undefined) return ''
  return member.you ? m.widget_members_you({ who: member.who }) : member.who
}

/** The groups as home words them. */
const rowsOf = (groups: readonly SampleGroup[]): GroupRow[] =>
  groups.map(({ key, name, members }) => ({
    key,
    name,
    who:
      members.length === 0
        ? m.widget_groups_nobody()
        : members.map(whoIs).join(m.widget_groups_joiner()),
  }))

function LiveGroups({
  manages,
  nameOf,
  nameLimit,
}: { manages: boolean } & GroupsWidgetGalleryProps) {
  const [groups, setGroups] = useState(sampleGroups)
  const [open, setOpen] = useState<string>()
  const [name, setName] = useState('')
  const [refused, setRefused] = useState<string>()
  const opened = groups.find((group) => group.key === open)
  const back = () => {
    setOpen(undefined)
    setRefused(undefined)
  }
  if (open !== undefined) {
    return (
      <GroupWidget
        title={sampleName}
        name={name}
        onNameChange={(typed) => {
          setName(typed)
          setRefused(undefined)
        }}
        refused={refused}
        nameLimit={nameLimit}
        members={
          opened === undefined
            ? undefined
            : sampleMembers.map((member) => ({
                key: member.key,
                who: whoIs(member.key),
                in: opened.members.includes(member.key),
              }))
        }
        onSave={() => {
          const kept = nameOf(name)
          const taken = groups.some(
            (group) => group.key !== open && group.name.toLowerCase() === kept?.toLowerCase(),
          )
          if (kept === undefined || taken) {
            setRefused(
              kept === undefined
                ? m.error_iam_group_name_invalid()
                : m.error_iam_group_name_taken(),
            )
            return
          }
          if (opened === undefined) {
            const key = `group-${String(groups.length + 1)}`
            setGroups([...groups, { key, name: kept, members: [] }])
            setOpen(key)
          } else {
            setGroups(groups.map((group) => (group === opened ? { ...group, name: kept } : group)))
            back()
          }
        }}
        onToggle={(key, placed) => {
          if (opened === undefined) return
          const members = placed
            ? [...opened.members, key]
            : opened.members.filter((member) => member !== key)
          setGroups(groups.map((group) => (group === opened ? { ...group, members } : group)))
        }}
        onDelete={
          opened === undefined
            ? undefined
            : () => {
                setGroups(groups.filter((group) => group !== opened))
                toast(m.widget_group_deleted({ name: opened.name }))
                back()
              }
        }
        onBack={back}
      />
    )
  }
  return (
    <GroupsWidget
      title={sampleName}
      everyone={m.widget_groups_everyone({ title: sampleName })}
      groups={rowsOf(groups)}
      manages={manages}
      onOpen={(key) => {
        setOpen(key)
        setName(groups.find((group) => group.key === key)?.name ?? '')
      }}
      onNew={() => {
        setOpen('new')
        setName('')
      }}
      onDone={() => {
        setGroups(sampleGroups)
      }}
    />
  )
}
