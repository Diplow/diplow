// The share widget on /design-system, live on a sample tile: Everyone set to read, to none, or back to
// what the tile above has, each row worded as home words it, and the link copied. Nothing reaches
// Mapping: what home would set shows in a toast, and the rows follow the choice as Mapping would
// answer them, the tile above, its star, letting Everyone read.
import { useState } from 'react'

import { m } from '#/paraglide/messages'

import { toast } from '../../../atoms/Toaster'
import { GalleryColumn, GallerySection, GalleryState } from '../../../gallery/frame'
import { said } from '../../samples'
import { type ReachRow, type ShareChoice, ShareWidget } from './ShareWidget'

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
          <LiveShare first="read" />
        </GalleryColumn>
      </GalleryState>
    </GallerySection>
  )
}

/** A sample tile's link, plainly a sample's: it leads nowhere. */
const sampleLink = 'https://hexframe.ai/t/00000000-0000-4000-8000-000000000000'

/** Everyone's row once the choice landed, as home words what Mapping answers. */
const everyoneOf = (choice: ShareChoice): ReachRow & { choice: ShareChoice } => ({
  key: 'everyone',
  who: m.widget_share_everyone(),
  value: choice === 'none' ? m.widget_share_none() : m.widget_share_read(),
  from: choice === 'inherit' ? m.widget_share_from_star() : m.widget_share_set_here(),
  choice,
})

/** A choice, as its widget words it. */
const chosenWords: Record<ShareChoice, () => string> = {
  read: m.widget_share_choice_read,
  none: m.widget_share_choice_none,
  inherit: m.widget_share_choice_inherit,
}

/** Someone else reaching it, by a Grant set on the tile above. */
const others = (): ReachRow[] => [
  {
    key: 'group',
    who: m.widget_share_group(),
    value: [m.widget_share_read(), m.widget_share_write()].join(m.widget_share_rights_joiner()),
    from: m.widget_share_from({ title: m.gallery_sample_chat_projects() }),
  },
]

function LiveShare({
  first,
  others: withOthers = false,
}: {
  first: ShareChoice
  others?: boolean
}) {
  const [choice, setChoice] = useState(first)
  return (
    <ShareWidget
      title={m.gallery_sample_chat_tooling()}
      everyone={everyoneOf(choice)}
      others={withOthers ? others() : []}
      onChoose={(next) => {
        setChoice(next)
        toast(m.gallery_share_chosen({ choice: chosenWords[next]() }))
      }}
      link={sampleLink}
      onCopyLink={said(m.widget_share_copy_link())}
      onDone={() => {
        setChoice(first)
      }}
    />
  )
}
