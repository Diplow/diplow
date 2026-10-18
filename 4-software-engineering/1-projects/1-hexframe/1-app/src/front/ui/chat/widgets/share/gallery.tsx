// The share widget on /design-system, live on a sample tile: Everyone set to read, to none, or back to
// what the tile above has, someone named by their star set to any value, each row worded as home
// words it, and the link copied. Nothing reaches Mapping: what home would set, and the star picker it
// would open to add someone, show in a toast, and the rows follow the choice as Mapping would answer
// them, the tile above, its star, letting Everyone read.
import { useState } from 'react'

import { m } from '#/paraglide/messages'

import { toast } from '../../../atoms/Toaster'
import { GalleryColumn, GallerySection, GalleryState } from '../../../gallery/frame'
import { said } from '../../samples'
import { rightsSaid } from './rights'
import { type Chosen, type ReachRow, type ShareChoice, ShareWidget } from './ShareWidget'

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

/** Where a value set comes from, as home words it: here, or the tile above, its star. */
const fromOf = (choice: ShareChoice) =>
  choice === 'inherit' ? m.widget_share_from_star() : m.widget_share_set_here()

/** Everyone's row once the choice landed, as home words what Mapping answers. */
const everyoneOf = (choice: ShareChoice): ReachRow & Chosen => ({
  key: 'everyone',
  who: m.widget_share_everyone(),
  value: rightsSaid(choice === 'none' ? 'none' : 'read'),
  from: fromOf(choice),
  choice,
})

/** Bob, someone the tile is shared with, once the choice landed: inheriting, he reads nothing. */
const bobOf = (choice: ShareChoice): ReachRow & Chosen => ({
  key: 'bob',
  who: 'Bob Martin',
  value: rightsSaid(choice === 'inherit' ? 'none' : choice),
  from: choice === 'inherit' ? m.widget_share_by_default() : m.widget_share_set_here(),
  choice,
})

/** A group reaching it, by a Grant set on the tile above, which nobody sets here yet. */
const group = (): ReachRow => ({
  key: 'group',
  who: m.widget_share_group(),
  value: rightsSaid('read+write'),
  from: m.widget_share_from({ title: m.gallery_sample_chat_projects() }),
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
  return (
    <ShareWidget
      title={m.gallery_sample_chat_tooling()}
      everyone={everyoneOf(choice)}
      others={withOthers ? [bobOf(bobs), group()] : []}
      onChoose={(key, next) => {
        const who = key === 'bob' ? 'Bob Martin' : m.widget_share_everyone()
        if (key === 'bob') setBobs(next)
        else setChoice(next)
        const words = next === 'inherit' ? m.widget_share_choice_inherit() : rightsSaid(next)
        toast(m.gallery_share_chosen({ who, choice: words }))
      }}
      onAdd={said(m.gallery_share_add())}
      link={sampleLink}
      onCopyLink={said(m.widget_share_copy_link())}
      onDone={() => {
        setChoice(first)
        setBobs('read+write')
      }}
    />
  )
}
