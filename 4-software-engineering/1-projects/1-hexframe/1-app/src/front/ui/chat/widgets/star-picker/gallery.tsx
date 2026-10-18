// The star picker on /design-system, live on sample stars: a few letters of a title find those it
// starts first, then those holding it, two of one name told apart by their previews; a link pasted
// leads to its star, to nowhere, or to the user's own. Nothing reaches Mapping: what is typed is read
// by Mapping's own rule, which the route hands over, the stars found as Mapping would answer, and a
// pick says in a toast who home would hand on.
import { useState } from 'react'

import { m } from '#/paraglide/messages'

import { toast } from '../../../atoms/Toaster'
import { GalleryColumn, GallerySection, GalleryState } from '../../../gallery/frame'
import { type StarShown, type StarsShown, StarPicker } from './StarPicker'

interface StarPickerGalleryProps {
  /** Mapping's reading of what is typed: the query it makes, none while too short to search. */
  queryOf: (typed: string) => string | undefined
}

export function StarPickerGallery({ queryOf }: StarPickerGalleryProps) {
  return (
    <GallerySection name="StarPicker">
      <GalleryState label={m.gallery_state_star_live()}>
        <GalleryColumn>
          <LivePicker queryOf={queryOf} first="" />
        </GalleryColumn>
      </GalleryState>
      <GalleryState label={m.gallery_state_star_homonyms()}>
        <GalleryColumn>
          <LivePicker queryOf={queryOf} first="Ana Lima" />
        </GalleryColumn>
      </GalleryState>
      <GalleryState label={m.gallery_state_star_nowhere()}>
        <GalleryColumn>
          <LivePicker queryOf={queryOf} first={`/t/${keptTile}`} />
        </GalleryColumn>
      </GalleryState>
      <GalleryState label={m.gallery_state_star_own()}>
        <GalleryColumn>
          <LivePicker queryOf={queryOf} first={`/t/${ownStar}`} />
        </GalleryColumn>
      </GalleryState>
      <GalleryState label={m.gallery_state_widget_phone()}>
        <GalleryColumn phone>
          <LivePicker queryOf={queryOf} first="an" />
        </GalleryColumn>
      </GalleryState>
    </GallerySection>
  )
}

/** A sample star's id, plainly a sample's. */
const sampleId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

/** The user's own star, and a tile kept from them, in the samples' links. */
const ownStar = sampleId(90)
const keptTile = sampleId(91)

/** The sample stars, their names as people write them, their previews in the page's language. */
const sampleStars = (): readonly StarShown[] => [
  { id: sampleId(1), title: 'Ana Lima', preview: m.gallery_star_garden() },
  { id: sampleId(2), title: 'Ana Lima', preview: m.gallery_star_bridges() },
  { id: sampleId(3), title: 'Anaëlle Roux', preview: m.gallery_star_ceramics() },
  { id: sampleId(4), title: 'Banana Club', preview: m.gallery_star_club() },
  { id: sampleId(5), title: 'Bob Martin', preview: m.gallery_star_bob() },
]

/**
 * Where what is typed leads, as Mapping would answer on these samples: a link to a sample star's
 * page leads to it, to the user's own star as their own, anywhere else nowhere; a Title finds the
 * stars it starts first, then those holding it, whatever its case.
 */
function foundFor(typed: string, queryOf: (typed: string) => string | undefined): StarsShown {
  const stars = sampleStars()
  const text = typed.trim()
  if (/^(?:\/|https?:\/\/)/i.test(text)) {
    if (text.endsWith(ownStar)) return { state: 'own' }
    const linked = stars.find(({ id }) => text.endsWith(id))
    return linked === undefined ? { state: 'nowhere' } : { state: 'found', stars: [linked] }
  }
  const query = queryOf(text)?.toLocaleLowerCase()
  if (query === undefined) return { state: 'short' }
  const titled = (star: StarShown) => star.title.toLocaleLowerCase()
  return {
    state: 'found',
    stars: [
      ...stars.filter((star) => titled(star).startsWith(query)),
      ...stars.filter((star) => !titled(star).startsWith(query) && titled(star).includes(query)),
    ],
  }
}

function LivePicker({
  first,
  queryOf,
}: {
  first: string
  queryOf: (typed: string) => string | undefined
}) {
  const [typed, setTyped] = useState(first)
  return (
    <StarPicker
      title={m.gallery_star_ask()}
      typed={typed}
      onType={setTyped}
      found={foundFor(typed, queryOf)}
      onPick={(star) => {
        toast(m.gallery_star_picked({ title: star.title }))
      }}
      onCancel={() => {
        setTyped(first)
      }}
    />
  )
}
