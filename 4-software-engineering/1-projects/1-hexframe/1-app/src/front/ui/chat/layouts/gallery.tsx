// The chat's own layouts, on /design-system: the widget's frame, in each of its states, on a
// proposal of the agent's, and in the human's voice and the app's.
import { Eye, HexagonIcon, KeyRound, Move, Pin, RotateCcw, Split } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { m } from '#/paraglide/messages'

import { Act } from '../../atoms/controls/act'
import { toast } from '../../atoms/Toaster'
import { GallerySection, GalleryState } from '../../gallery/frame'
import { Widget, type WidgetState } from './Widget'

export function ChatLayoutsGallery() {
  return (
    <GallerySection name="Widget">
      <GalleryState label={m.gallery_state_widget_live()}>
        <LiveWidget />
      </GalleryState>
      <GalleryState label={m.gallery_state_widget_folded()}>
        <Column>
          <Proposal state="waiting" defaultFolded />
        </Column>
      </GalleryState>
      <GalleryState label={m.gallery_state_widget_working()}>
        <Column>
          <Proposal state="working" />
        </Column>
      </GalleryState>
      <GalleryState label={m.gallery_state_widget_done()}>
        <Column>
          <Proposal state="done" />
        </Column>
      </GalleryState>
      <GalleryState label={m.gallery_state_widget_failed()}>
        <Column>
          <Proposal state="failed" />
        </Column>
      </GalleryState>
      <GalleryState label={m.gallery_state_widget_voices()}>
        <Column>
          <Widget
            voice="human"
            icon={<Pin />}
            kicker={m.gallery_widget_human_kicker()}
            title={m.gallery_widget_human_title()}
            subtitle={m.gallery_widget_human_subtitle()}
            actions={[{ label: m.gallery_sample_open(), onSelect: done(m.gallery_sample_open()) }]}
            onDismiss={done(m.ui_widget_dismiss())}
          />
          <Widget
            voice="app"
            icon={<KeyRound />}
            kicker={m.gallery_widget_app_kicker()}
            title={m.gallery_widget_app_title()}
            subtitle={m.gallery_widget_app_subtitle()}
            actions={[
              { label: m.gallery_widget_app_issue(), onSelect: done(m.gallery_widget_app_issue()) },
            ]}
            onDismiss={done(m.ui_widget_dismiss())}
          />
        </Column>
      </GalleryState>
    </GallerySection>
  )
}

const done = (what: string) => () => {
  toast(what)
}

/** The conversation's column: the zones run edge to edge, to the curve. */
function Column({ children }: { children: ReactNode }) {
  return <div className="grid w-[37.5rem] max-w-full gap-6">{children}</div>
}

// The agent's proposal to split a tile, as the conversation would show it in each state.
function Proposal({
  state,
  defaultFolded,
  onAccept = done(m.gallery_sample_accept()),
  onUndo = done(m.ui_undo()),
  onDismiss = done(m.ui_widget_dismiss()),
}: {
  state: WidgetState
  defaultFolded?: boolean
  onAccept?: () => void
  onUndo?: () => void
  onDismiss?: () => void
}) {
  const [pinned, setPinned] = useState(false)
  const failed = state === 'failed'
  const kicker = {
    waiting: m.gallery_widget_kicker_waiting,
    working: m.gallery_widget_kicker_working,
    done: m.gallery_widget_kicker_waiting,
    failed: m.gallery_widget_kicker_failed,
  }[state]
  return (
    <Widget
      voice="agent"
      icon={<Split />}
      state={state}
      defaultFolded={defaultFolded}
      kicker={kicker()}
      title={m.gallery_widget_title()}
      subtitle={m.gallery_widget_subtitle()}
      actions={
        state === 'working'
          ? [{ label: m.gallery_widget_stop(), onSelect: done(m.gallery_widget_stop()) }]
          : [
              {
                label: failed ? m.ui_retry() : m.gallery_sample_accept(),
                keys: failed ? undefined : ['⌘', '↵'],
                onSelect: onAccept,
              },
              {
                label: failed ? m.gallery_widget_show_changed() : m.gallery_sample_show_on_canvas(),
                onSelect: done(m.gallery_sample_show_on_canvas()),
              },
              { label: m.gallery_widget_discard(), onSelect: onDismiss, apart: true },
            ]
      }
      receipt={{ text: m.gallery_widget_receipt(), at: '14:02', onUndo }}
      settings={[
        {
          label: m.gallery_sample_pin(),
          icon: <Pin />,
          checked: pinned,
          onCheckedChange: setPinned,
        },
        {
          label: m.gallery_sample_show_on_canvas(),
          icon: <Eye />,
          onSelect: done(m.gallery_sample_show_on_canvas()),
        },
      ]}
      onDismiss={onDismiss}
    >
      {failed ? (
        <p className="text-[0.84375rem] leading-normal font-light text-muted-foreground">
          {m.gallery_widget_failed_body()}
        </p>
      ) : (
        <Changes />
      )}
    </Widget>
  )
}

/** What the proposal changes, a line each, its icon in the voice. */
function Changes() {
  const changes = [
    { icon: <HexagonIcon />, text: m.gallery_widget_change_create() },
    { icon: <Move />, text: m.gallery_widget_change_move_site() },
    { icon: <Move />, text: m.gallery_widget_change_move_design() },
  ]
  return (
    <ul className="grid gap-2">
      {changes.map(({ icon, text }) => (
        <li
          key={text}
          className="grid grid-cols-[0.875rem_1fr] gap-2.5 text-[0.84375rem] leading-snug font-light text-muted-foreground [&_svg]:mt-0.5 [&_svg]:size-3.5 [&_svg]:stroke-[1.4] [&_svg]:text-(--voice)"
        >
          {icon}
          <span>{text}</span>
        </li>
      ))}
    </ul>
  )
}

// One widget that runs: accepting it works a moment then leaves its receipt, undo brings it back,
// and its entrance replays on demand.
function LiveWidget() {
  const [state, setState] = useState<WidgetState>('waiting')
  const [entrance, setEntrance] = useState(0)
  const accept = () => {
    setState('working')
    setTimeout(() => {
      setState('done')
    }, 1600)
  }
  return (
    <Column>
      <Proposal
        key={entrance}
        state={state}
        onAccept={accept}
        onUndo={() => {
          setState('waiting')
        }}
      />
      <Act
        className="justify-self-start"
        onClick={() => {
          setState('waiting')
          setEntrance(entrance + 1)
        }}
      >
        <RotateCcw className="size-3" />
        {m.gallery_widget_replay()}
      </Act>
    </Column>
  )
}
