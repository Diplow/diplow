// The help widget on /design-system, on Help itself, read in the page's language and handed over by
// the route, which `ui/` can't read: turn its pages by the map or by what they lead to, search it, see
// the shortcuts. Opening in Help and asking the agent show in a toast.
import { useState, type ReactNode } from 'react'

import { m } from '#/paraglide/messages'

import { toast } from '../../../atoms/Toaster'
import { GallerySection, GalleryState } from '../../../gallery/frame'
import { places, type Place } from '../Places'
import { topicsFor, type HelpTopic } from './find'
import { HelpWidget } from './HelpWidget'

/** A topic of Help and the six below it, as the route hands Help over. */
export interface HelpNode extends HelpTopic {
  readonly children: Partial<Readonly<Record<Place, HelpNode>>>
}

export function HelpWidgetGallery({ help }: { help: HelpNode }) {
  return (
    <GallerySection name="HelpWidget">
      <GalleryState label={m.gallery_state_help_topic()}>
        <Column>
          <Reading help={help} />
        </Column>
      </GalleryState>
      <GalleryState label={m.gallery_state_help_search()}>
        <Column>
          <Searching help={help} typed={m.gallery_help_search_sample()} />
        </Column>
      </GalleryState>
      <GalleryState label={m.gallery_state_help_none()}>
        <Column>
          <Searching help={help} typed="xyzzy" />
        </Column>
      </GalleryState>
      <GalleryState label={m.gallery_state_help_keys()}>
        <Column>
          <HelpWidget state="keys" onDismiss={said(m.ui_widget_dismiss())} />
        </Column>
      </GalleryState>
      <GalleryState label={m.gallery_state_widget_phone()}>
        <Column phone>
          <Reading help={help} />
        </Column>
      </GalleryState>
    </GallerySection>
  )
}

const said = (what: string) => () => {
  toast(what)
}

function Column({ phone = false, children }: { phone?: boolean; children: ReactNode }) {
  return (
    <div
      className={
        phone ? 'grid w-[23.4375rem] max-w-full gap-4' : 'grid w-[37.5rem] max-w-full gap-4'
      }
    >
      {children}
    </div>
  )
}

/** The topic a path of places leads to from Help's Root, and the topics on the way. */
function follow(help: HelpNode, path: readonly Place[]) {
  const trail = [help]
  for (const place of path) {
    const next = trail.at(-1)?.children[place]
    if (next === undefined) break
    trail.push(next)
  }
  return trail
}

/** Every topic of Help, the Root first, then each topic's six in their order. */
function topicsOf(node: HelpNode): HelpNode[] {
  return [
    node,
    ...places.flatMap((place) => {
      const child = node.children[place]
      return child === undefined ? [] : topicsOf(child)
    }),
  ]
}

/** The places that lead from the Root to a topic, found by its id. */
function pathTo(node: HelpNode, id: string): Place[] | undefined {
  if (node.id === id) return []
  for (const place of places) {
    const child = node.children[place]
    const below = child === undefined ? undefined : pathTo(child, id)
    if (below !== undefined) return [place, ...below]
  }
  return undefined
}

// A topic, read where it stands: a pick on the map turns to a neighbour, a mention reads on, deeper
// or to the next two around.
function Reading({ help }: { help: HelpNode }) {
  const [path, setPath] = useState<readonly Place[]>([3])
  const trail = follow(help, path)
  const topic = trail.at(-1) ?? help
  const parent = trail.at(-2)
  const lit = path.at(-1)
  const below = places.flatMap((place) => topic.children[place] ?? [])
  const around =
    lit === undefined || parent === undefined
      ? []
      : [1, 2].flatMap((step) => parent.children[(((lit - 1 + step) % 6) + 1) as Place] ?? [])
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
            const child = (parent ?? topic).children[place]
            return child === undefined ? [] : [[place, child.title]]
          }),
        ),
        lit: parent === undefined ? undefined : lit,
      }}
      onPlace={(place) => {
        setPath(parent === undefined ? [place] : [...path.slice(0, -1), place])
      }}
      readOn={(below.length > 0 ? below : around).map(({ id, title }) => ({ id, title }))}
      onReadOn={(id) => {
        setPath(pathTo(help, id) ?? path)
      }}
      onOpenInHelp={said(m.widget_help_open())}
      onAsk={said(m.widget_help_ask())}
      onDismiss={() => {
        setPath([3])
      }}
    />
  )
}

// What `/help` and a few words find, retyped here in a field of the page's own.
function Searching({ help, typed: first }: { help: HelpNode; typed: string }) {
  const [typed, setTyped] = useState(first)
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
        found={topicsFor(topicsOf(help), typed)}
        onFound={(id) => {
          toast(topicsOf(help).find((topic) => topic.id === id)?.title ?? id)
        }}
        onDismiss={said(m.ui_widget_dismiss())}
      />
    </>
  )
}
