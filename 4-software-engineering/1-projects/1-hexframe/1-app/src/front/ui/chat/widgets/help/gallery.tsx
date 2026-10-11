// The help widget on /design-system, on Help itself, read in the page's language and handed over by
// the route, which `ui/` can't read: turn its pages by the map or by what they lead to, search it, see
// the shortcuts. The way around is the demo's (`../demo.ts`); opening in Help and asking the agent show
// in a toast.
import { useState } from 'react'

import { m } from '#/paraglide/messages'

import { toast } from '../../../atoms/Toaster'
import { GalleryColumn, GallerySection, GalleryState } from '../../../gallery/frame'
import { said } from '../../samples'
import { follow, placesTo, readOnOf, topicsOf, type HelpNode } from '../demo'
import { places, type Place } from '../Places'
import { topicsFor } from './find'
import { HelpWidget } from './HelpWidget'

export function HelpWidgetGallery({ help }: { help: HelpNode }) {
  return (
    <GallerySection name="HelpWidget">
      <GalleryState label={m.gallery_state_help_topic()}>
        <GalleryColumn>
          <Reading help={help} />
        </GalleryColumn>
      </GalleryState>
      <GalleryState label={m.gallery_state_help_search()}>
        <GalleryColumn>
          <Searching help={help} typed={m.gallery_help_search_sample()} />
        </GalleryColumn>
      </GalleryState>
      <GalleryState label={m.gallery_state_help_none()}>
        <GalleryColumn>
          <Searching help={help} typed="xyzzy" />
        </GalleryColumn>
      </GalleryState>
      <GalleryState label={m.gallery_state_help_keys()}>
        <GalleryColumn>
          <HelpWidget state="keys" onDismiss={said(m.ui_widget_dismiss())} />
        </GalleryColumn>
      </GalleryState>
      <GalleryState label={m.gallery_state_widget_phone()}>
        <GalleryColumn phone>
          <Reading help={help} />
        </GalleryColumn>
      </GalleryState>
    </GallerySection>
  )
}

/** Where the specimen opens: Help's third topic, Children and Directions. */
const first: readonly Place[] = [3]

// A topic, read where it stands: a pick on the map turns to a neighbour, a topic it leads to reads on.
function Reading({ help }: { help: HelpNode }) {
  const [path, setPath] = useState(first)
  const trail = follow(help, path)
  const topic = trail.at(-1) ?? help
  const parent = trail.at(-2)
  const frame = parent ?? topic
  return (
    <HelpWidget
      state="topic"
      title={topic.title}
      preview={topic.preview}
      body={topic.body}
      path={trail.slice(0, -1).map(({ title }) => title)}
      frame={{
        titles: Object.fromEntries(
          places.flatMap((place) => {
            const child = frame.children[place]
            return child === undefined ? [] : [[place, child.title]]
          }),
        ),
        lit: parent === undefined ? undefined : path.at(-1),
      }}
      onPlace={(place) => {
        setPath(parent === undefined ? [place] : [...path.slice(0, -1), place])
      }}
      readOn={readOnOf(help, path).map(({ id, title }) => ({ id, title }))}
      onReadOn={(id) => {
        setPath(placesTo(help, id) ?? path)
      }}
      onOpenInHelp={said(m.widget_help_open())}
      onAsk={said(m.widget_help_ask())}
      onDismiss={() => {
        setPath(first)
      }}
    />
  )
}

// What `/help` and a few words find, retyped here in a field of the page's own.
function Searching({ help, typed: firstTyped }: { help: HelpNode; typed: string }) {
  const [typed, setTyped] = useState(firstTyped)
  const topics = topicsOf(help)
  return (
    <>
      <label className="grid gap-1 text-xs text-muted-foreground">
        {m.gallery_help_search_label()}
        <input
          value={typed}
          onChange={(event) => {
            setTyped(event.target.value)
          }}
          className="border-b border-input bg-transparent pb-1 font-human text-base text-foreground outline-none focus:border-human"
        />
      </label>
      <HelpWidget
        state="search"
        typed={typed}
        found={topicsFor(topics, typed)}
        onFound={(id) => {
          toast(topics.find((topic) => topic.id === id)?.title ?? id)
        }}
        onDismiss={said(m.ui_widget_dismiss())}
      />
    </>
  )
}
