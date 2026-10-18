// The Organization widgets on /design-system, live on samples: an Organization named, refused while
// its name is blank, made in a toast, and on a phone; and its members, as an admin manages them, as a member reads
// them, and on a phone. Nothing reaches IAM: what home would change, and the star picker it would
// open to add someone, show in a toast, and the rows follow each change as IAM would answer it, its
// last admin kept.
import { useState } from 'react'

import { m } from '#/paraglide/messages'

import { toast } from '../../../../atoms/Toaster'
import { GalleryColumn, GallerySection, GalleryState } from '../../../../gallery/frame'
import { said } from '../../../samples'
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
