// The canvas's own specimen on /design-system, beside the canvas on the fixture's views: opening its
// center introduced, as the tutorial introduces it (HEX-121), on the fixture's Root.
import { RotateCcw } from 'lucide-react'
import { useState } from 'react'

import { m } from '#/paraglide/messages'

import { Act } from '../atoms/controls/act'
import { GalleryState } from '../gallery/frame'
import { Canvas } from './Canvas'
import { ulysse } from './fixtures'
import type { CanvasView } from './view/view'

/**
 * The fixture's Root alone and large, the one thing that answers: it invites its click, which opens
 * it, its six arriving one by one from the top left, answering nothing but their hover card; a click
 * on the center folds it back. Played again from its folded center at will.
 */
export function IntroducedCanvas() {
  const [view, setView] = useState<CanvasView>({})
  const [play, setPlay] = useState(0)
  return (
    <GalleryState label={m.gallery_state_canvas_introduced()}>
      <p className="max-w-prose text-sm text-muted-foreground">{m.gallery_canvas_introduced()}</p>
      <Canvas
        key={play}
        system={ulysse}
        view={view}
        onViewChange={setView}
        looking="card"
        lets={(hex) => ({ click: hex.role === 'center', recenter: false })}
        introducesOpening
        className="h-96 w-[37.5rem] max-w-full"
      />
      <Act
        className="justify-self-start"
        icon={<RotateCcw />}
        onClick={() => {
          setView({})
          setPlay(play + 1)
        }}
      >
        {m.gallery_replay()}
      </Act>
    </GalleryState>
  )
}
