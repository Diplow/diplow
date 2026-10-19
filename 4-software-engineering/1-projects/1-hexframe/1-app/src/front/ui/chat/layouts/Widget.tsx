import { cn } from 'cn'
import { ChevronDown, ChevronRight, MoreHorizontal, RotateCw, X } from 'lucide-react'
import { Collapsible } from 'radix-ui'
import {
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react'

import { m } from '#/paraglide/messages'

import { Act, voiceOf, type Voice as AnyVoice } from '../../atoms/controls/act'
import { pressed, type Shortcut } from '../../atoms/keys'
import { Menu, type MenuEntry } from '../../atoms/Menu'
import { runsToCurve, toCurve, useAlongCurve } from '../../layouts/screen/state/useAlongCurve'
import { zone } from './zone'

/** Whose the widget is: the agent asking, the user's own words, or the app's (a key, help). */
type Voice = Exclude<AnyVoice, 'destructive'>

/**
 * Where it stands: `waiting` on the user, `working` while what was asked runs, `failed` with a way to
 * try again, `done` once it ran, the widget then its receipt alone. Folded or open is the user's.
 */
export type WidgetState = 'waiting' | 'working' | 'failed' | 'done'

interface WidgetAction {
  label: string
  onSelect: () => void
  /** Its shortcut, drawn after it so the action teaches it; it runs while the focus is in the widget, open. */
  shortcut?: Shortcut
  /** Pushed to the row's end, apart: a way out such as Discard. */
  apart?: boolean
  /** What was asked is on its way: the action does nothing more, yet keeps the focus it has. */
  waits?: boolean
  /** `hex`, the one solid act a form asks for (`Act`'s look); a word otherwise. */
  look?: 'text' | 'hex'
  /** A line icon saying what it does, in place of the small hex before its word. */
  icon?: ReactNode
  /** It loses something, and says so in the destructive voice: a tile's Delete. */
  destructive?: boolean
  /**
   * Enter in one of the widget's one-line fields runs it, as a click does: its submit. One action at
   * most; none where Enter must not decide, a save over someone else's change.
   */
  submit?: boolean
}

interface ZoneProps {
  voice: Voice
  /** A line icon, drawn inside the widget's hex. */
  icon?: ReactNode
  /**
   * Drawn in the hex's place instead, the size of a small tile: what the widget is about, in small, such
   * as the frame a tile goes in, its slot lit. It speaks for itself to a screen reader.
   */
  mark?: ReactNode
  /** Who, or what state, in a few words: "proposed by your agent"; none where the title says it all. */
  kicker?: string
  /** What it is about; its name to a screen reader, even where `titleField` draws it. */
  title: string
  /** In the title's place, the field that writes it, at the title's size: a tile's title. */
  titleField?: ReactNode
  /** One line more, hidden while folded. */
  subtitle?: string
  /** Whatever the widget is for: a list, a form, a key. While `working`, light runs over the lines to come instead. */
  children?: ReactNode
  /** Its actions; the first is the one it expects, in its voice. */
  actions?: readonly WidgetAction[]
  state?: Exclude<WidgetState, 'done'>
  /** Its settings, in the menu behind its tools, above folding and dismissing. */
  settings?: readonly MenuEntry[]
  onDismiss?: () => void
  /** Its tools, settings, fold and dismiss; none where it is there to be answered: a pseudo asked. */
  tools?: boolean
  /** Folded at first; the user folds and unfolds it after. */
  defaultFolded?: boolean
}

interface DoneProps {
  voice: Voice
  /** Once what was asked ran, the zone gives its surface back and leaves this one line. */
  state: 'done'
  receipt: { text: ReactNode; at?: string; onUndo?: () => void }
}

type WidgetProps = ZoneProps | DoneProps

// Each part rises after the line and the surface, one after another.
const rise = (step: number): CSSProperties => ({
  animationDelay: `calc(0.28s + ${String(step)} * var(--stagger-bloom) * 2)`,
})
const risesInTurn = 'motion-safe:animate-rise'

/**
 * Everything the conversation asks of the user or shows them beyond words: a zone in the flow of
 * messages, tinted toward the curve by whose it is. One shape for all of them, learned once: an icon,
 * a kicker and a title beside it, a subtitle, then a body and its actions the zone's whole width, each
 * running on to the curve at its height, and its tools riding the curve when the user reaches for them.
 */
export function Widget(props: WidgetProps) {
  return props.state === 'done' ? <Receipt {...props} /> : <Zone {...props} />
}

function Zone({
  voice,
  icon,
  mark,
  kicker,
  title,
  titleField,
  subtitle,
  children,
  actions = [],
  state = 'waiting',
  settings = [],
  onDismiss,
  tools = true,
  defaultFolded = false,
}: ZoneProps) {
  const [folded, setFolded] = useState(defaultFolded)
  const [menuOpen, setMenuOpen] = useState(false)
  const titleId = useId()
  const failed = state === 'failed'
  // An action's key runs it while the focus is in the widget and its actions show, and Enter in a
  // one-line field runs its submit; never while the action waits, nor while what was asked runs. A key
  // its menu or its body took stays theirs, and so does one from the menu's portal, outside the zone.
  const runShortcut = (event: KeyboardEvent<HTMLElement>) => {
    if (folded || event.defaultPrevented || event.nativeEvent.isComposing) return
    if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return
    const action =
      actions.find(({ shortcut }) => pressed(shortcut, event)) ??
      (event.target instanceof HTMLInputElement && pressed({ key: 'Enter' }, event)
        ? actions.find(({ submit }) => submit === true)
        : undefined)
    if (action === undefined || action.waits === true || state === 'working') return
    event.preventDefault()
    action.onSelect()
  }
  return (
    <Collapsible.Root
      open={!folded}
      onOpenChange={(open) => {
        setFolded(!open)
      }}
      asChild
    >
      <section
        aria-labelledby={titleField === undefined ? titleId : undefined}
        aria-label={titleField === undefined ? undefined : title}
        aria-busy={state === 'working'}
        onKeyDown={runShortcut}
        className={cn(
          voiceOf(failed ? 'destructive' : voice),
          // The chat's zone, tinted toward the curve by its voice, with one more fine line below.
          zone,
          "group/widget py-5 after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-linear-to-r after:from-transparent after:via-input after:via-45% after:to-input after:content-['']",
          // In the conversation it runs the chat's whole width, the curve its edge, never a box, its
          // content where the lines are (`--chat-left`, `--chat-right`); elsewhere it keeps its own.
          'mr-[calc(var(--chat-right,0px)*-1)] ml-[calc(var(--chat-left,0px)*-1)]',
          'pr-[var(--chat-right,1rem)] pl-[var(--chat-left,1rem)] sm:pr-[var(--chat-right,1.5rem)] sm:pl-[var(--chat-left,2.25rem)]',
          voice === 'app' && !failed && 'bg-none',
          // Coming in: the line on top draws itself, the surface unfolds from it, its parts rise in turn.
          'motion-safe:animate-unfold motion-safe:before:animate-draw',
        )}
      >
        <div className="grid grid-cols-[2.25rem_1fr] gap-x-3.5 sm:grid-cols-[3.375rem_1fr] sm:gap-x-[1.125rem]">
          <Mark state={state} icon={icon} mark={mark} />
          {/*
            Its words beside the hex, centered on it, running on to the curve at their height; a
            subtitle left empty takes no room.
          */}
          <div ref={toCurve} className={cn(runsToCurve, 'min-w-0 self-center')}>
            {/*
              The tools sit over the kicker and the title's end, which leave them the room they take
              where they ride the curve (`--along-curve`) short of where the words run to
              (`--to-curve`), and no more, so a title field runs on.
            */}
            <div
              className={cn(
                tools &&
                  'pr-[max(0px,calc(var(--to-curve,0px)+var(--along-curve,5rem)))] pointer-coarse:pr-12',
              )}
            >
              {kicker !== undefined && (
                <p
                  aria-live="polite"
                  className={cn(
                    'flex items-center gap-2 font-agent text-[0.71875rem] leading-normal',
                    voice === 'app' && !failed ? 'text-faint' : 'text-(--voice)',
                    risesInTurn,
                  )}
                  style={rise(1)}
                >
                  {state === 'working' && (
                    <span className="size-1.5 shrink-0 rounded-full bg-current shadow-[0_0_10px_1px_currentColor] motion-safe:animate-breathe" />
                  )}
                  {kicker}
                </p>
              )}
              {titleField === undefined ? (
                <h3
                  id={titleId}
                  className={cn(
                    'mt-px font-human text-[1.3125rem] leading-tight font-normal text-foreground',
                    risesInTurn,
                  )}
                  style={rise(2)}
                >
                  {title}
                </h3>
              ) : (
                <div className={cn('mt-px', risesInTurn)} style={rise(2)}>
                  {titleField}
                </div>
              )}
            </div>
            {subtitle !== undefined && subtitle !== '' && !folded && (
              <p
                className={cn(
                  'mt-[3px] text-[0.84375rem] leading-normal font-light text-muted-foreground',
                  risesInTurn,
                )}
                style={rise(3)}
              >
                {subtitle}
              </p>
            )}
          </div>
          {/*
            Below the hex and the title, its body and its actions take the zone's whole width, and
            past it, wide, as far as the curve lets them at their height, the chat's gap short of it;
            a row of its own inside runs on further where the curve bows out at the row's height, past
            the body, which clips only as it folds.
          */}
          <Collapsible.Content
            ref={toCurve}
            className={cn(
              runsToCurve,
              'col-span-2 min-w-0 overflow-x-visible overflow-y-clip data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down motion-reduce:animate-none!',
            )}
          >
            {(state === 'working' || children !== undefined) && (
              <div className={cn('pt-4', risesInTurn)} style={rise(4)}>
                {state === 'working' ? <LinesToCome /> : children}
              </div>
            )}
            <Actions actions={actions} />
          </Collapsible.Content>
        </div>
        {tools && (
          <Tools
            folded={folded}
            held={menuOpen}
            onMenuOpenChange={setMenuOpen}
            settings={settings}
            onFold={() => {
              setFolded(!folded)
            }}
            onDismiss={onDismiss}
          />
        )}
      </section>
    </Collapsible.Root>
  )
}

/** Its hex and line icon, or the mark drawn in its place; a failure's hex says to try again. */
function Mark({
  state,
  icon,
  mark,
}: {
  state: Exclude<WidgetState, 'done'>
  icon: ReactNode
  mark: ReactNode
}) {
  if (mark === undefined || state === 'failed') {
    return <Hex working={state === 'working'}>{state === 'failed' ? <RotateCw /> : icon}</Hex>
  }
  return (
    <div
      className={cn(
        'relative h-[2.125rem] w-9 self-center text-(--voice) sm:h-[3.125rem] sm:w-[3.375rem]',
        state === 'working' && 'motion-safe:animate-breathe',
        risesInTurn,
      )}
      style={rise(0)}
    >
      {mark}
    </div>
  )
}

/**
 * Its actions in a row, the first the one it expects, in its voice, one that loses something in the
 * destructive voice; the row running on to the curve at its height, so one set apart sits against it.
 */
function Actions({ actions }: { actions: readonly WidgetAction[] }) {
  if (actions.length === 0) return null
  return (
    <div
      ref={toCurve}
      className={cn(
        runsToCurve,
        'mt-[1.125rem] flex flex-wrap items-center gap-x-[1.375rem] gap-y-1',
        risesInTurn,
      )}
      style={rise(5)}
    >
      {actions.map((action, index) => (
        <Act
          key={action.label}
          look={action.look}
          icon={action.icon}
          tone={index === 0 || action.destructive === true ? 'voice' : 'quiet'}
          shortcut={action.shortcut}
          waits={action.waits === true}
          onClick={action.onSelect}
          className={cn(
            action.destructive === true && voiceOf('destructive'),
            action.apart === true && 'ml-auto',
          )}
        >
          {action.label}
        </Act>
      ))}
    </div>
  )
}

/** The widget's hex, the size of a small tile, a line icon inside; while working, it breathes. */
function Hex({ working, children }: { working: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        'relative h-[2.125rem] w-9 self-center text-(--voice) sm:h-[3.125rem] sm:w-[3.375rem]',
        risesInTurn,
      )}
      style={rise(0)}
      aria-hidden="true"
    >
      <svg viewBox="-27 -25 54 50" className="absolute inset-0 size-full overflow-visible">
        <polygon
          points="0,-23 19.92,-11.5 19.92,11.5 0,23 -19.92,11.5 -19.92,-11.5"
          vectorEffect="non-scaling-stroke"
          className="fill-(--voice)/7 stroke-(--voice)/55"
        />
        {working && (
          <polygon
            points="0,-23 19.92,-11.5 19.92,11.5 0,23 -19.92,11.5 -19.92,-11.5"
            className="fill-(--voice)/22 motion-safe:animate-breathe"
          />
        )}
      </svg>
      <span className="absolute top-1/2 left-1/2 -translate-1/2 [&_svg]:size-4 [&_svg]:stroke-[1.3] sm:[&_svg]:size-[1.1875rem]">
        {children}
      </span>
    </div>
  )
}

/** While working: light runs over the lines still to come. */
function LinesToCome() {
  return (
    <div className="grid gap-[9px]" role="presentation">
      {['82%', '64%', '72%'].map((width) => (
        <i
          key={width}
          style={{ width }}
          className="block h-2 bg-linear-to-r from-muted from-30% via-(--voice)/18 via-50% to-muted to-70% bg-size-[300%_100%] motion-safe:animate-sweep"
        />
      ))}
    </div>
  )
}

interface ToolsProps {
  folded: boolean
  held: boolean
  onMenuOpenChange: (open: boolean) => void
  settings: readonly MenuEntry[]
  onFold: () => void
  onDismiss?: () => void
}

/** A setting drawn as its own control beside fold and dismiss: a plain action, with its icon. */
type ToolItem = Extract<MenuEntry, { onSelect: () => void }> & { icon: ReactNode }

/** How many tools the head shows side by side at most; past it, they all wait in its menu. */
const toolsAtMost = 3

/** The settings drawn side by side with fold and dismiss, if they all fit: none where they don't. */
function sideBySide(settings: readonly MenuEntry[], count: number): ToolItem[] | undefined {
  if (count > toolsAtMost) return undefined
  const items = settings.filter((entry) => entry !== 'separator')
  const plain = items.filter(
    (entry): entry is ToolItem => 'onSelect' in entry && entry.icon !== undefined,
  )
  return plain.length === items.length ? plain : undefined
}

/**
 * Settings, fold and dismiss, at the head's height, riding just inside the curve, so they slide along
 * it as the conversation scrolls (`useAlongCurve`); where the chat is not cut, at the end of its
 * lines. They show on hover or focus, side by side while they are three at most, each a plain action
 * with its icon, else all of them in the menu behind one control, which never shows beside them. A
 * finger can't hover: under one, that control alone shows, a full target, every tool in its menu.
 */
function Tools({ folded, held, onMenuOpenChange, settings, onFold, onDismiss }: ToolsProps) {
  const tools = useRef<HTMLDivElement>(null)
  useAlongCurve(tools)
  const entries: MenuEntry[] = [
    ...settings,
    ...(settings.length > 0 ? (['separator'] as const) : []),
    {
      label: folded ? m.ui_widget_unfold() : m.ui_widget_fold(),
      icon: folded ? <ChevronRight /> : <ChevronDown />,
      onSelect: onFold,
    },
    ...(onDismiss === undefined
      ? []
      : [{ label: m.ui_widget_dismiss(), icon: <X />, onSelect: onDismiss }]),
  ]
  const shown = sideBySide(settings, entries.filter((entry) => entry !== 'separator').length)
  return (
    <div
      ref={tools}
      className={cn(
        'absolute top-3.5 right-[var(--chat-right,0.5rem)] flex opacity-0 transition-opacity duration-250 group-focus-within/widget:opacity-100 group-hover/widget:opacity-100 sm:right-[var(--chat-right,1.125rem)] pointer-coarse:top-2 pointer-coarse:opacity-100',
        held && 'opacity-100',
      )}
    >
      <Menu
        label={m.ui_widget_settings()}
        align="end"
        entries={entries}
        onOpenChange={onMenuOpenChange}
        trigger={
          <button
            type="button"
            aria-label={m.ui_widget_settings()}
            className={cn(tool, shown && 'hidden pointer-coarse:grid')}
          >
            <MoreHorizontal />
          </button>
        }
      />
      {shown?.map((setting) => (
        <button
          key={setting.label}
          type="button"
          aria-label={setting.label}
          onClick={setting.onSelect}
          className={cn(tool, 'pointer-coarse:hidden')}
        >
          {setting.icon}
        </button>
      ))}
      {shown && (
        <Collapsible.Trigger asChild>
          <button
            type="button"
            aria-label={folded ? m.ui_widget_unfold() : m.ui_widget_fold()}
            className={cn(tool, 'pointer-coarse:hidden')}
          >
            <ChevronDown className="transition-transform duration-300 ease-glide group-data-[state=closed]/widget:-rotate-90" />
          </button>
        </Collapsible.Trigger>
      )}
      {shown && onDismiss !== undefined && (
        <button
          type="button"
          aria-label={m.ui_widget_dismiss()}
          onClick={onDismiss}
          className={cn(tool, 'pointer-coarse:hidden')}
        >
          <X />
        </button>
      )}
    </div>
  )
}

const tool =
  'grid size-[1.625rem] cursor-pointer place-items-center text-faint transition-colors hover:bg-foreground/7 hover:text-foreground focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-(--voice) pointer-coarse:size-11 [&_svg]:size-[0.9375rem]'

/**
 * Once done, the zone gives its surface back and leaves one line in the conversation, running on to
 * the curve, its time at its end.
 */
function Receipt({ voice, receipt }: DoneProps) {
  return (
    <p
      ref={toCurve}
      role="status"
      className={cn(
        voiceOf(voice),
        runsToCurve,
        'flex items-center gap-2.5 px-4 font-agent text-[0.78125rem] leading-normal text-muted-foreground motion-safe:animate-rise sm:px-9 [&_b]:font-normal [&_b]:text-foreground',
      )}
    >
      <svg viewBox="-8 -8 16 16" className="size-3.5 shrink-0 overflow-visible" aria-hidden="true">
        <polygon
          points="0,-7 6.06,-3.5 6.06,3.5 0,7 -6.06,3.5 -6.06,-3.5"
          vectorEffect="non-scaling-stroke"
          className="fill-(--voice)/22 stroke-(--voice)"
        />
      </svg>
      <span>{receipt.text}</span>
      {receipt.onUndo !== undefined && (
        <Act onClick={receipt.onUndo} className="ml-1.5 text-[0.78125rem]">
          {m.ui_undo()}
        </Act>
      )}
      {receipt.at !== undefined && (
        <span className="ml-auto text-[0.6875rem] text-faint">{receipt.at}</span>
      )}
    </p>
  )
}
