// The chat's own atom, on /design-system: the fold, set as text in the chat's flow.
import { m } from '#/paraglide/messages'

import { GallerySection, GalleryState } from '../../gallery/frame'
import { Fold } from './fold'

export function ChatAtomsGallery() {
  return (
    <GallerySection name="Fold">
      <GalleryState label={m.gallery_state_chat_fold()}>
        <div className="grid gap-2 font-agent text-xs">
          <Fold label={m.chat_thought({ seconds: 9 })}>
            <p className="max-w-prose text-faint">{m.gallery_sample_chat_thinking()}</p>
          </Fold>
        </div>
      </GalleryState>
    </GallerySection>
  )
}
