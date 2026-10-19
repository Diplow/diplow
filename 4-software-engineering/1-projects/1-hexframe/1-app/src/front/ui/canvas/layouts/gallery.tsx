// The canvas's own layouts, on /design-system: its corner, where you are, on your System or across a
// gap on someone else's, and the journey from one System to another, on the fixture's.
import { useState } from 'react'

import { m } from '#/paraglide/messages'

import { Act } from '../../atoms/controls/act'
import { GallerySection, GalleryState } from '../../gallery/frame'
import { cornerPlace } from '../../layouts/screen/Screen'
import { Canvas } from '../Canvas'
import { elsewhere, ulysse, visited } from '../fixtures'
import { pathTo, type TileNode } from '../view/tiles'
import { Journey } from './Journey'
import { Rail } from './Rail'

export function CanvasLayoutsGallery() {
  return (
    <>
      <GallerySection name="Rail">
        <GalleryState label={m.gallery_state_at_the_root()}>
          <RailSpecimen from={ulysse.id} />
        </GalleryState>
        <GalleryState label={m.gallery_state_one_level_down()}>
          <RailSpecimen from="software-engineering" />
        </GalleryState>
        <GalleryState label={m.gallery_state_three_levels_down()}>
          <RailSpecimen from="hexframe" />
        </GalleryState>
        <GalleryState label={m.gallery_state_across_a_gap()}>
          <RailSpecimen system={visited} from="app" />
        </GalleryState>
      </GallerySection>
      <GallerySection name="Journey">
        <GalleryState label={m.gallery_state_journey()}>
          <JourneySpecimen />
        </GalleryState>
      </GallerySection>
    </>
  )
}

// The corner of a canvas on a fixture System, the user's unless said, from a Tile down the vault; a
// step up centers on it.
function RailSpecimen({ system = ulysse, from }: { system?: TileNode; from: string }) {
  const [here, setHere] = useState(from)
  return (
    <div className="relative h-72 w-80 bg-background">
      <Rail steps={pathTo(system, here)} onSelect={setHere} className={cornerPlace} />
    </div>
  )
}

/**
 * A canvas that travels from the reader's sun, the fixture's Root, to another System and back: there
 * by the act below it, back by the corner's mark, each center arriving alone and large.
 */
function JourneySpecimen() {
  const [away, setAway] = useState(false)
  const system = away ? elsewhere : ulysse
  const back = () => {
    setAway(false)
  }
  return (
    <div className="grid gap-3">
      <div className="relative flex h-96 w-[37.5rem] max-w-full overflow-clip bg-background">
        <Journey at={system.id}>
          <Canvas
            system={system}
            view={{}}
            onViewChange={() => undefined}
            className="min-h-0 flex-1 p-4"
          />
        </Journey>
        <Rail
          steps={pathTo(system, system.id)}
          onSelect={() => undefined}
          onHome={away ? back : undefined}
          className={cornerPlace}
        />
      </div>
      <Act
        className="justify-self-start"
        disabled={away}
        onClick={() => {
          setAway(true)
        }}
      >
        {m.gallery_journey_travel({ title: elsewhere.title })}
      </Act>
    </div>
  )
}
