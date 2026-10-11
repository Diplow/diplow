// The chat's own atoms, on /design-system: the suggestions over the composer's field, and the controls
// set as text in the chat's flow, an action and a fold.
import { useState } from 'react'

import { m } from '#/paraglide/messages'

import { Input } from '../../atoms/controls/input'
import { toast } from '../../atoms/Toaster'
import { GallerySection, GalleryState } from '../../gallery/frame'
import { Act, Fold } from './controls'
import { Suggestions, suggestionsField } from './Suggestions'

export function ChatAtomsGallery() {
  return (
    <>
      <GallerySection name="Suggestions">
        <GalleryState label={m.gallery_state_click_to_show()}>
          <SuggestionsSpecimen />
        </GalleryState>
      </GallerySection>
      <GallerySection name="Act">
        <GalleryState label={m.gallery_state_chat_act_tones()}>
          <div className="flex flex-wrap items-center gap-x-5.5 gap-y-2">
            <Act tone="agent">{m.chat_proposal_accept()}</Act>
            <Act tone="human">{m.gallery_sample_save()}</Act>
            <Act>{m.chat_receipt_undo()}</Act>
            <Act tone="destructive">{m.gallery_sample_delete()}</Act>
          </div>
        </GalleryState>
        <GalleryState label={m.gallery_state_disabled()}>
          <Act tone="agent" disabled>
            {m.chat_proposal_accept()}
          </Act>
        </GalleryState>
      </GallerySection>
      <GallerySection name="Fold">
        <GalleryState label={m.gallery_state_chat_fold()}>
          <div className="grid gap-2 font-agent text-xs">
            <Fold label={m.chat_thought({ seconds: 9 })}>
              <p className="max-w-prose text-faint">{m.gallery_sample_chat_thinking()}</p>
            </Fold>
          </div>
        </GalleryState>
      </GallerySection>
    </>
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
