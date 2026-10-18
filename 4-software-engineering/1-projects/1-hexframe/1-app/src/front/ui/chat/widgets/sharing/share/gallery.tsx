// The share widget on /design-system, live on a sample tile: Everyone set to read, to none, or back to
// what the tile above has, someone named by their star and a group by its name set to any value, a
// grant left to a group gone cleared, each row worded as home words it, and the link copied. Nothing
// reaches Mapping: what home would set, and the star picker or the group picker it would open to add
// someone or a group, show in a toast, and the rows follow the choice as Mapping would answer them,
// the tile above, its star, letting Everyone read. And the group picker itself (HEX-137): the groups
// of the Organizations the user belongs to, one shared with already said so, and none.
import { useState } from 'react'

import { m } from '#/paraglide/messages'

import { toast } from '../../../../atoms/Toaster'
import { GalleryColumn, GallerySection, GalleryState } from '../../../../gallery/frame'
import { said } from '../../../samples'
import { GroupPicker, type GroupsOf } from './GroupPicker'
import { choiceSaid, rightsSaid, type ShareChoice } from './rights'
import { type Chosen, type ReachRow, ShareWidget } from './ShareWidget'

export function ShareWidgetGallery() {
  return (
    <GallerySection name="ShareWidget">
      <GalleryState label={m.gallery_state_share_live()}>
        <GalleryColumn>
          <LiveShare first="inherit" />
        </GalleryColumn>
      </GalleryState>
      <GalleryState label={m.gallery_state_share_kept()}>
        <GalleryColumn>
          <LiveShare first="none" />
        </GalleryColumn>
      </GalleryState>
      <GalleryState label={m.gallery_state_share_others()}>
        <GalleryColumn>
          <LiveShare first="read" others />
        </GalleryColumn>
      </GalleryState>
      <GalleryState label={m.gallery_state_widget_phone()}>
        <GalleryColumn phone>
          <LiveShare first="read" others />
        </GalleryColumn>
      </GalleryState>
    </GallerySection>
  )
}

/** A sample tile's link, plainly a sample's: it leads nowhere. */
const sampleLink = 'https://hexframe.ai/t/00000000-0000-4000-8000-000000000000'

/** What Everyone is offered, as home offers it: never a write. */
const everyoneOffered: readonly ShareChoice[] = ['read', 'none', 'inherit']

/** What someone is offered, as home offers it: every value, then inherit. */
const someoneOffered: readonly ShareChoice[] = [
  'none',
  'read',
  'read+write',
  'read+@',
  'read+write+@',
  'inherit',
]

/** The rights each sample choice gives Bob, as Mapping would answer: inheriting, none. */
const bobsRights: Record<ShareChoice, readonly ('read' | 'write' | '@')[]> = {
  none: [],
  read: ['read'],
  'read+write': ['read', 'write'],
  'read+@': ['read', '@'],
  'read+write+@': ['read', 'write', '@'],
  inherit: [],
}

/** Where a value set comes from, as home words it: here, or the tile above, its star. */
const fromOf = (choice: ShareChoice) =>
  choice === 'inherit' ? m.widget_share_from_star() : m.widget_share_set_here()

/** Everyone's row once the choice landed, as home words what Mapping answers. */
const everyoneOf = (choice: ShareChoice): ReachRow & Chosen => ({
  key: 'everyone',
  who: m.widget_share_everyone(),
  value: rightsSaid(choice === 'none' ? [] : ['read']),
  from: fromOf(choice),
  choice,
  offered: everyoneOffered,
})

/** Bob, someone the tile is shared with, once the choice landed: inheriting, he reads nothing. */
const bobOf = (choice: ShareChoice): ReachRow & Chosen => ({
  key: 'bob',
  who: 'Bob Martin',
  value: rightsSaid(bobsRights[choice]),
  from: choice === 'inherit' ? m.widget_share_by_default() : m.widget_share_set_here(),
  choice,
  offered: someoneOffered,
})

/** A group reaching it, by a Grant set on the tile above, which its owner may set here too. */
const groupOf = (choice: ShareChoice): ReachRow & Chosen => ({
  key: 'group',
  who: m.widget_share_group_named({ name: 'Design', organization: 'Atelier' }),
  value: rightsSaid(choice === 'inherit' ? ['read', 'write'] : bobsRights[choice]),
  from:
    choice === 'inherit'
      ? m.widget_share_from({ title: m.gallery_sample_chat_projects() })
      : m.widget_share_set_here(),
  choice,
  offered: someoneOffered,
})

/** A grant set here for a group since deleted: it reaches nobody, and its owner clears it. */
const gone = (): ReachRow => ({
  key: 'gone',
  who: m.widget_share_group_gone(),
  value: rightsSaid(['read']),
  from: m.widget_share_set_here(),
  clears: true,
})

function LiveShare({
  first,
  others: withOthers = false,
}: {
  first: ShareChoice
  others?: boolean
}) {
  const [choice, setChoice] = useState(first)
  const [bobs, setBobs] = useState<ShareChoice>('read+write')
  const [design, setDesign] = useState<ShareChoice>('inherit')
  const [cleared, setCleared] = useState(false)
  const others = [bobOf(bobs), groupOf(design), ...(cleared ? [] : [gone()])]
  return (
    <ShareWidget
      title={m.gallery_sample_chat_tooling()}
      everyone={everyoneOf(choice)}
      others={withOthers ? others : []}
      onChoose={(key, next) => {
        const who = others.find((row) => row.key === key)?.who ?? m.widget_share_everyone()
        if (key === 'bob') setBobs(next)
        else if (key === 'group') setDesign(next)
        else if (key === 'gone') setCleared(true)
        else setChoice(next)
        toast(m.gallery_share_chosen({ who, choice: choiceSaid(next) }))
      }}
      onAdd={said(m.gallery_share_add())}
      onAddGroup={withOthers ? said(m.gallery_share_add_group()) : undefined}
      link={sampleLink}
      onCopyLink={said(m.widget_share_copy_link())}
      onDone={() => {
        setChoice(first)
        setBobs('read+write')
        setDesign('inherit')
        setCleared(false)
      }}
    />
  )
}

export function GroupPickerGallery() {
  return (
    <GallerySection name="GroupPicker">
      <GalleryState label={m.gallery_state_group_picker_live()}>
        <GalleryColumn>
          <GroupPicker
            title={m.widget_share_with_which_group({ title: m.gallery_sample_chat_tooling() })}
            organizations={sampleOrganizations()}
            onPick={(organization, group) => {
              const picked = sampleOrganizations()
                .find(({ key }) => key === organization)
                ?.groups.find(({ key }) => key === group)
              toast(m.gallery_group_picked({ name: picked?.name ?? '' }))
            }}
            onCancel={said(m.widget_group_picker_cancel())}
          />
        </GalleryColumn>
      </GalleryState>
      <GalleryState label={m.gallery_state_group_picker_none()}>
        <GalleryColumn>
          <GroupPicker
            title={m.widget_share_with_which_group({ title: m.gallery_sample_chat_tooling() })}
            organizations={[]}
            onPick={() => undefined}
            onCancel={said(m.widget_group_picker_cancel())}
          />
        </GalleryColumn>
      </GalleryState>
      <GalleryState label={m.gallery_state_widget_phone()}>
        <GalleryColumn phone>
          <GroupPicker
            title={m.widget_share_with_which_group({ title: m.gallery_sample_chat_tooling() })}
            organizations={sampleOrganizations()}
            onPick={said(m.gallery_share_add_group())}
            onCancel={said(m.widget_group_picker_cancel())}
          />
        </GalleryColumn>
      </GalleryState>
    </GallerySection>
  )
}

/**
 * The sample Organizations the user belongs to, in the page's language: Atelier, whose Members share
 * the tile already, and Studio.
 */
const sampleOrganizations = (): readonly GroupsOf[] => [
  {
    key: 'atelier',
    name: 'Atelier',
    groups: [
      { key: 'members', name: m.widget_groups_members(), named: true },
      { key: 'design', name: 'Design' },
      { key: 'ops', name: 'Ops' },
    ],
  },
  {
    key: 'studio',
    name: 'Studio',
    groups: [{ key: 'members', name: m.widget_groups_members() }],
  },
]
