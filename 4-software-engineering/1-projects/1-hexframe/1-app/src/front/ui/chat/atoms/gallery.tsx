// The chat's own atoms, on /design-system: the suggestions over the composer's field.
import { useState } from 'react'

import { m } from '#/paraglide/messages'

import { Input } from '../../atoms/controls/input'
import { toast } from '../../atoms/Toaster'
import { GallerySection, GalleryState } from '../../gallery/frame'
import { Suggestions, suggestionsField } from './Suggestions'

export function ChatAtomsGallery() {
  return (
    <GallerySection name="Suggestions">
      <GalleryState label={m.gallery_state_click_to_show()}>
        <SuggestionsSpecimen />
      </GalleryState>
    </GallerySection>
  )
}

// On a real page, a state hook says what is offered and which is active; here a demo holds it: the
// list shows while the field has the focus, and the arrows move the active suggestion.
function SuggestionsSpecimen() {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const suggestions = [
    {
      id: 'leadership',
      label: m.gallery_sample_leadership(),
      detail: m.gallery_sample_tile_preview(),
    },
    { id: 'education', label: m.gallery_sample_education() },
    { id: 'games', label: m.gallery_sample_games() },
  ]
  const pick = (id: string) => {
    toast(suggestions.find((suggestion) => suggestion.id === id)?.label ?? id)
  }
  return (
    <Suggestions
      id="gallery-suggestions"
      label={m.gallery_sample_tile_title()}
      open={open}
      suggestions={suggestions}
      active={suggestions[active]?.id}
      onPick={pick}
      onClose={() => {
        setOpen(false)
      }}
    >
      <Input
        aria-label={m.gallery_sample_tile_title()}
        className="max-w-72"
        {...suggestionsField('gallery-suggestions', open, suggestions[active]?.id)}
        onFocus={() => {
          setOpen(true)
        }}
        onBlur={() => {
          setOpen(false)
        }}
        onKeyDown={(event) => {
          const by = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
          if (by === 0) return
          event.preventDefault()
          setActive((active + by + suggestions.length) % suggestions.length)
        }}
      />
    </Suggestions>
  )
}
