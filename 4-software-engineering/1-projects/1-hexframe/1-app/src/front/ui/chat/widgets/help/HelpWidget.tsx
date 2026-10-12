// Help in the conversation, where the user is, rather than on another page: the app's own widget. A
// topic shows its place among its six, its page, and where to read on; its hex is Help's own frame,
// the topic lit, and a pick on another place turns the page, so the map is also the way around. `/help`
// and a few words list the topics they show in, what was typed marked; `?` shows the shortcuts,
// grouped by where they work. Controlled: the topic, what was found and what each pick does are its
// caller's.
import { BookOpen, Keyboard, Search } from 'lucide-react'
import { Fragment } from 'react'

import { m } from '#/paraglide/messages'

import { Keys } from '../../../atoms/keys'
import { HexMark } from '../../atoms/hex'
import { Widget } from '../../layouts/Widget'
import { Mention } from '../../text/Mention'
import { namesByPlace, Places, places, type Place } from '../Places'
import type { Found } from './topics'
import { shortcuts } from './shortcuts'

/** A topic read: what it says, and where it stands among its parent's six. */
interface Reading {
  state: 'topic'
  title: string
  preview: string
  /** Its page, as written: Markdown reads as written until the seam renders it. */
  body: string
  /** Its parent's titles from Help's Root, said in its kicker. */
  path: readonly string[]
  /** Its parent's frame: the title in each of the six places, the topic's own lit. */
  frame: {
    readonly titles: Partial<Readonly<Record<Place, string>>>
    readonly lit?: Place | undefined
  }
  onPlace: (place: Place) => void
  /** Where to read on: the tiles it leads to, as mentions. */
  readOn: ReadonlyArray<{ readonly id: string; readonly title: string }>
  /** A mention taken: as any mention, it centers the canvas on that tile, Help, and the widget turns to it. */
  onReadOn: (id: string) => void
  /** Centers the canvas on Help at this topic. */
  onOpenInHelp: () => void
  /** Asks the agent about it; none where no agent can be asked, and Ask about it goes. */
  onAsk?: (() => void) | undefined
  onDismiss: () => void
}

interface Searching {
  state: 'search'
  typed: string
  found: readonly Found[]
  onFound: (id: string) => void
  onDismiss: () => void
}

interface Shortcuts {
  state: 'keys'
  onDismiss: () => void
}

type HelpWidgetProps = Reading | Searching | Shortcuts

/** Help in the conversation: a topic, what a search found, or the shortcuts. */
export function HelpWidget(props: HelpWidgetProps) {
  if (props.state === 'search') return <Results {...props} />
  if (props.state === 'keys') return <ShortcutsShown {...props} />
  return <Topic {...props} />
}

function Topic({
  title,
  preview,
  body,
  path,
  frame,
  onPlace,
  readOn,
  onReadOn,
  onOpenInHelp,
  onAsk,
  onDismiss,
}: Reading) {
  const names = namesByPlace((place) => frame.titles[place] ?? m.widget_help_no_topic())
  const taken = places.filter((place) => frame.titles[place] !== undefined)
  return (
    <Widget
      voice="app"
      icon={<BookOpen />}
      mark={
        taken.length === 0 ? undefined : (
          <Places
            label={m.widget_help_map()}
            names={names}
            lit={frame.lit}
            onPick={onPlace}
            pickable={taken}
            className="[--voice:var(--foreground)]"
          />
        )
      }
      kicker={[m.widget_help_kicker(), ...path].join(' / ')}
      title={title}
      subtitle={preview === '' ? undefined : preview}
      actions={[
        { label: m.widget_help_open(), onSelect: onOpenInHelp },
        ...(onAsk === undefined ? [] : [{ label: m.widget_help_ask(), onSelect: onAsk }]),
      ]}
      onDismiss={onDismiss}
    >
      <div className="grid gap-4">
        <p className="text-sm leading-[1.65] font-light whitespace-pre-wrap text-muted-foreground">
          {body}
        </p>
        {readOn.length > 0 && (
          <nav aria-label={m.widget_help_read_on()} className="flex flex-wrap gap-x-4 gap-y-1.5">
            <span className="w-full font-mono text-[0.6875rem] text-muted-foreground">
              {m.widget_help_read_on()}
            </span>
            {readOn.map(({ id, title: on }) => (
              <span key={id} className="text-[0.8125rem] font-light">
                <Mention
                  title={on}
                  onCenter={() => {
                    onReadOn(id)
                  }}
                />
              </span>
            ))}
          </nav>
        )}
      </div>
    </Widget>
  )
}

/** The most topics a search shows: a few to choose among, not an index. */
const shownAtMost = 6

function Results({ typed, found, onFound, onDismiss }: Searching) {
  return (
    <Widget
      voice="app"
      icon={<Search />}
      kicker={m.widget_help_found_kicker({ count: String(found.length), typed })}
      title={found.length === 0 ? m.widget_help_found_none() : m.widget_help_found_title()}
      subtitle={found.length === 0 ? m.widget_help_found_none_hint() : undefined}
      onDismiss={onDismiss}
    >
      {found.length > 0 ? (
        <ul className="grid">
          {found.slice(0, shownAtMost).map(({ id, title, excerpt }) => (
            <li key={id} className="border-t border-border last:border-b">
              <button
                type="button"
                onClick={() => {
                  onFound(id)
                }}
                className="group/found grid w-full cursor-pointer grid-cols-[0.875rem_1fr] gap-3 py-2.5 text-left outline-none focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-(--voice)"
              >
                <HexMark className="mt-1 size-3.5 fill-foreground/9 stroke-input group-hover/found:stroke-foreground" />
                <span className="grid gap-0.5">
                  <span className="font-human text-[0.9375rem] leading-tight text-foreground decoration-input underline-offset-[3px] group-hover/found:underline">
                    {title}
                  </span>
                  <span className="text-[0.78125rem] leading-normal font-light text-muted-foreground">
                    {excerpt.before}
                    {excerpt.match !== '' && (
                      <mark className="bg-transparent font-normal text-foreground shadow-[inset_0_-1px_0_var(--input)]">
                        {excerpt.match}
                      </mark>
                    )}
                    {excerpt.after}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : undefined}
    </Widget>
  )
}

function ShortcutsShown({ onDismiss }: Shortcuts) {
  return (
    <Widget
      voice="app"
      icon={<Keyboard />}
      kicker={m.widget_help_keys_kicker()}
      title={m.widget_help_keys_title()}
      subtitle={m.widget_help_keys_again()}
      onDismiss={onDismiss}
    >
      <div className="grid gap-3.5">
        {shortcuts.map(({ where, rows }) => (
          <section key={where()} className="grid gap-1.5">
            <h4 className="font-mono text-[0.6875rem] text-muted-foreground">{where()}</h4>
            <dl className="grid grid-cols-[1fr_auto] items-center gap-x-5 gap-y-[7px] text-[0.8125rem] leading-normal font-light text-muted-foreground">
              {rows.map(({ does, keys }) => (
                <Fragment key={does()}>
                  <dt>{does()}</dt>
                  <dd className="flex gap-1.5 justify-self-end text-foreground">
                    <span className="sr-only">{keys.map(said).join(', ')}</span>
                    {keys.map((shortcut) => (
                      <Keys key={said(shortcut)} shortcut={shortcut} />
                    ))}
                  </dd>
                </Fragment>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Widget>
  )
}

/** A shortcut as a screen reader is told it, since `Keys` draws it for the eye alone. */
const said = ({
  key,
  shift = false,
  mod = false,
}: {
  key: string
  shift?: boolean
  mod?: boolean
}) =>
  [
    ...(mod ? [m.widget_help_key_mod()] : []),
    ...(shift ? ['Shift'] : []),
    key === ' ' ? 'Space' : key,
  ].join(' ')
