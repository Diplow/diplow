// The star picker on /design-system, live on sample stars: a few letters of a title find those it
// starts first, then those holding it, two of one name told apart by their previews; a link pasted
// leads to its star, to nowhere, or to the user's own. Nothing reaches Mapping: what is typed is read
// as home reads it, a Title or a link, by the reading the route hands over, the stars found as Mapping
// would answer, and a pick says in a toast who home would hand on.
import { useState } from 'react'

import { m } from '#/paraglide/messages'

import { toast } from '../../../../atoms/Toaster'
import { GalleryColumn, GallerySection, GalleryState } from '../../../../gallery/frame'
import { type StarShown, type StarsShown, StarPicker } from './StarPicker'

/**
 * What is typed, as home reads it on a page: a link, to the Tile it names on that page's site, or a
 * Title, the query it makes, none while too short to search.
 */
type Typed =
  | { readonly by: 'link'; readonly tile: string | undefined }
  | { readonly by: 'title'; readonly query: string | undefined }

/** How home reads what is typed in the picker, on the page at `page`. */
type TypedOf = (typed: string, page: string) => Typed

interface StarPickerGalleryProps {
  typedOf: TypedOf
}

export function StarPickerGallery({ typedOf }: StarPickerGalleryProps) {
  return (
    <GallerySection name="StarPicker">
      <GalleryState label={m.gallery_state_star_live()}>
        <GalleryColumn>
          <LivePicker typedOf={typedOf} first="" />
        </GalleryColumn>
      </GalleryState>
      <GalleryState label={m.gallery_state_star_homonyms()}>
        <GalleryColumn>
          <LivePicker typedOf={typedOf} first="Ana Lima" />
        </GalleryColumn>
      </GalleryState>
      <GalleryState label={m.gallery_state_star_nowhere()}>
        <GalleryColumn>
          <LivePicker typedOf={typedOf} first={`/t/${keptTile}`} />
        </GalleryColumn>
      </GalleryState>
      <GalleryState label={m.gallery_state_star_own()}>
        <GalleryColumn>
          <LivePicker typedOf={typedOf} first={`/t/${ownStar}`} />
        </GalleryColumn>
      </GalleryState>
      <GalleryState label={m.gallery_state_widget_phone()}>
        <GalleryColumn phone>
          <LivePicker typedOf={typedOf} first="an" />
        </GalleryColumn>
      </GalleryState>
    </GallerySection>
  )
}

/** The page the samples' links are read on, plainly a sample's. */
const samplePage = 'https://hexframe.ai/'

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
 * tile leads to it, to the user's own star as their own, anywhere else nowhere; a Title finds the
 * stars it starts first, then those holding it, whatever its case.
 */
function foundFor(typed: string, typedOf: TypedOf): StarsShown {
  const stars = sampleStars()
  const read = typedOf(typed, samplePage)
  if (read.by === 'link') {
    if (read.tile === ownStar) return { state: 'own' }
    const linked = stars.find(({ id }) => id === read.tile)
    return linked === undefined ? { state: 'nowhere' } : { state: 'found', stars: [linked] }
  }
  const query = read.query?.toLocaleLowerCase()
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

function LivePicker({ first, typedOf }: { first: string; typedOf: TypedOf }) {
  const [typed, setTyped] = useState(first)
  return (
    <StarPicker
      title={m.gallery_star_ask()}
      typed={typed}
      onType={setTyped}
      found={foundFor(typed, typedOf)}
      onPick={(star) => {
        toast(m.gallery_star_picked({ title: star.title }))
      }}
      onCancel={() => {
        setTyped(first)
      }}
    />
  )
}
