import { cn } from 'cn'
import { ChevronRight } from 'lucide-react'
import { ContextMenu, DropdownMenu } from 'radix-ui'
import {
  createContext,
  useContext,
  useRef,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react'

import { ariaShortcut, Keys, pressed, type Shortcut } from './keys'

interface MenuItem {
  label: string
  icon?: ReactNode
  /** Shown at the line's end, so the menu teaches it; typed with the menu open, it runs the entry. */
  shortcut?: Shortcut
  onSelect: () => void
  /**
   * Its action takes the focus elsewhere, to the composer's field: the menu, which holds the focus
   * while it is open, runs it once it has let the focus go, and leaves the focus where it went rather
   * than giving it back to its thing.
   */
  takesFocus?: boolean
  /** `agent` hands the thing to the agent, in its violet; `destructive` deletes or cannot be undone. */
  tone?: 'agent' | 'destructive'
  disabled?: boolean
}

interface MenuToggle {
  label: string
  icon?: ReactNode
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

/**
 * A line that opens a menu beside it, on hover, → or its key: entries, or a picture of choices drawn
 * with `MenuChoice`, a place to put something in, above them.
 */
interface MenuSubmenu {
  label: string
  icon?: ReactNode
  shortcut?: Shortcut
  submenu: {
    /** Its name, for a screen reader. */
    label: string
    picture?: ReactNode
    entries?: readonly MenuEntry[]
  }
}

/** An entry, a setting that is on or off, a submenu, or a line between two groups of them. */
export type MenuEntry = MenuItem | MenuToggle | MenuSubmenu | 'separator'

/** What the menu acts on, above its entries. */
interface MenuHeader {
  title: string
  /** Its kind and place, in a few words. */
  detail?: string
  /**
   * What a hover card would say, its preview in full. Shown only under a finger, which cannot hover,
   * so the long press that opens the menu shows the card too.
   */
  description?: string
}

interface MenuProps {
  /**
   * `click`: the trigger is a control that opens the menu, a Button most often. `context`: the
   * trigger is the thing the menu acts on, and a right click, a long press, ⇧F10 or the menu key open
   * it where that thing is.
   */
  opensOn?: 'click' | 'context'
  trigger: ReactElement
  /** The menu's name, for a screen reader: what it acts on. */
  label: string
  header?: MenuHeader
  entries: readonly MenuEntry[]
  align?: 'start' | 'end'
  /** Told when it opens and closes, so what it acts on stays lit while it is open. */
  onOpenChange?: (open: boolean) => void
}

type Line = Exclude<MenuEntry, 'separator'>

const isToggle = (entry: Line): entry is MenuToggle => 'checked' in entry
const isSubmenu = (entry: Line): entry is MenuSubmenu => 'submenu' in entry
const shortcutOf = (entry: Line) => (isToggle(entry) ? undefined : entry.shortcut)

// Enter or Space with no modifier: what a highlighted line takes to run itself.
const linesKey = (event: KeyboardEvent) =>
  (event.key === 'Enter' || event.key === ' ') &&
  !event.shiftKey &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.altKey

/**
 * A list of actions on one thing, navigable with the keyboard: behind a control, or where the thing
 * is, by a right click, a long press or ⇧F10. Each line can carry its key, which runs it; where the
 * thing is, on the thing too, focused, the menu shut.
 */
export function Menu({
  opensOn = 'click',
  trigger,
  label,
  header,
  entries,
  align = 'start',
  onOpenChange,
}: MenuProps) {
  // The submenu a key typed on the thing asked for, opened once the menu is.
  const opening = useRef<number>(undefined)
  const content = useRef<HTMLDivElement>(null)
  // A line that takes the focus elsewhere ran: closing, the menu leaves the focus there.
  const taken = useRef(false)
  const leaveFocusTaken = (event: Event) => {
    if (taken.current) event.preventDefault()
    taken.current = false
  }
  const body = (kit: Kit) => (
    <>
      {header !== undefined && <Header {...header} />}
      <KitContext value={kit}>
        <FocusTaken value={taken}>
          <Lines entries={entries} />
        </FocusTaken>
      </KitContext>
    </>
  )

  if (opensOn === 'context') {
    return (
      <ContextMenu.Root
        onOpenChange={(open) => {
          onOpenChange?.(open)
          const index = opening.current
          opening.current = undefined
          // The menu is drawn by the next frame: its submenu opens then.
          if (open && index !== undefined) {
            requestAnimationFrame(() => {
              if (content.current) openSubmenu(content.current, index)
            })
          }
        }}
      >
        <ContextMenu.Trigger
          asChild
          onKeyDown={(event) => {
            if (opensByKeyboard(event)) openAtTheThing(event.currentTarget)
            else runOnTheThing(event, entries, opening)
          }}
          // A long press opens the menu, not the browser's own callout over the thing.
          className="[-webkit-touch-callout:none]"
        >
          {trigger}
        </ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Content
            aria-label={label}
            {...keysOf(entries)}
            ref={content}
            onCloseAutoFocus={leaveFocusTaken}
            className={cn(surface, contextOrigin)}
          >
            {body(contextKit)}
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>
    )
  }
  return (
    <DropdownMenu.Root onOpenChange={onOpenChange}>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          aria-label={label}
          align={align}
          sideOffset={6}
          {...keysOf(entries)}
          onCloseAutoFocus={leaveFocusTaken}
          className={cn(surface, dropdownOrigin)}
        >
          {body(dropdownKit)}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

// Typing an entry's key runs it: the line is clicked, so Radix selects it and closes the menu; a
// submenu's opens it, its focus inside. Taking the key first, before the highlighted line and Radix's
// typeahead, keeps ⇧↵ or a letter from running the lit line or moving the focus instead. Enter and
// Space alone are the lines' own: they run the highlighted line, and an entry's only once no line is
// lit and took them. Escape is the menu's own, which closes it. A key pressed in a submenu is its own
// menu's: the one it opened from leaves it.
function keysOf(entries: readonly MenuEntry[]) {
  const runShortcut = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' || !event.currentTarget.contains(event.target as Node)) return
    const index = shortcutIndex(entries, event)
    if (index === -1) return
    event.preventDefault()
    const line = lineAt(event.currentTarget, index)
    if (line?.getAttribute('aria-haspopup') === 'menu') openSubmenu(event.currentTarget, index)
    else line?.click()
  }
  return {
    onKeyDownCapture: (event: KeyboardEvent<HTMLDivElement>) => {
      if (!linesKey(event)) runShortcut(event)
    },
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
      if (linesKey(event) && !event.defaultPrevented) runShortcut(event)
    },
  }
}

/** The entry a key press is the shortcut of, toggles aside, or -1. */
const shortcutIndex = (entries: readonly MenuEntry[], event: KeyboardEvent) =>
  entries.findIndex(
    (entry) => entry !== 'separator' && !isToggle(entry) && pressed(entry.shortcut, event),
  )

const lineAt = (content: HTMLElement, index: number) =>
  content.querySelector<HTMLElement>(`:scope > [data-entry="${String(index)}"]`)

/** A submenu opened as → opens it, its focus inside. */
function openSubmenu(content: HTMLElement, index: number) {
  const line = lineAt(content, index)
  line?.focus()
  line?.dispatchEvent(new globalThis.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
}

// An entry's key on the thing, focused, the menu shut, runs it there; a submenu's opens the menu at
// it. Enter and Space alone stay the thing's own, its click.
function runOnTheThing(
  event: KeyboardEvent<HTMLElement>,
  entries: readonly MenuEntry[],
  opening: { current: number | undefined },
) {
  // Once per press: a held key repeating would delete, or ask, again and again.
  if (linesKey(event) || event.repeat) return
  const index = shortcutIndex(entries, event)
  const entry = entries[index]
  if (entry === undefined || entry === 'separator' || isToggle(entry)) return
  event.preventDefault()
  if (isSubmenu(entry)) {
    opening.current = index
    openAtTheThing(event.currentTarget)
  } else if (entry.disabled !== true) entry.onSelect()
}

// ⇧F10 and the menu key open a context menu where its thing is. Browsers fire `contextmenu` for them
// at a corner of the page, or not at all: the key is taken, and the event sent at the thing's center.
function opensByKeyboard(event: KeyboardEvent<HTMLElement>): boolean {
  if (!((event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu')) return false
  event.preventDefault()
  return true
}

function openAtTheThing(thing: HTMLElement) {
  const box = thing.getBoundingClientRect()
  thing.dispatchEvent(
    new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: box.left + box.width / 2,
      clientY: box.top + box.height / 2,
    }),
  )
}

// A risen surface, lit a little above the ground, a fine line on top; it opens from where it was
// asked for, growing a little.
const surface =
  'risen relative z-50 max-h-(--radix-popper-available-height) min-w-[13.75rem] overflow-y-auto py-1.5 text-[0.8125rem] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-[0.97] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.97] data-[state=open]:duration-150 motion-reduce:animate-none!'

function Header({ title, detail, description }: MenuHeader) {
  return (
    <div className="grid gap-px px-3.5 pt-2 pb-2.5">
      <span className="font-human text-[0.9375rem] leading-tight text-foreground">{title}</span>
      {detail !== undefined && (
        <span className="font-mono text-[0.6875rem] text-faint">{detail}</span>
      )}
      {description !== undefined && (
        <span className="hidden max-w-64 pt-1 text-xs leading-normal text-muted-foreground pointer-coarse:block">
          {description}
        </span>
      )}
    </div>
  )
}

// The parts both menus share, so one entry draws the same behind a control and where its thing is,
// and the origin their surfaces grow from.
interface Kit {
  parts: Pick<
    typeof DropdownMenu,
    'Item' | 'CheckboxItem' | 'Separator' | 'Sub' | 'SubTrigger' | 'SubContent' | 'Portal'
  >
  origin: string
}

const contextOrigin = 'origin-(--radix-context-menu-content-transform-origin)'
const dropdownOrigin = 'origin-(--radix-dropdown-menu-content-transform-origin)'
const contextKit: Kit = { parts: ContextMenu, origin: contextOrigin }
const dropdownKit: Kit = { parts: DropdownMenu, origin: dropdownOrigin }

/** The menu its lines and a `MenuChoice` are drawn in, whose parts they take. */
const KitContext = createContext<Kit>(dropdownKit)

/** Whether a line of the menu that takes the focus elsewhere ran, which the menu reads as it closes. */
const FocusTaken = createContext<{ current: boolean }>({ current: false })

/**
 * A line's action, as its menu runs it: at once, or, for one that takes the focus elsewhere, a task
 * later, once the menu, closing, no longer holds the focus inside it, and told to the menu, which
 * then leaves the focus where it went.
 */
function selected(item: MenuItem, taken: { current: boolean }) {
  if (item.takesFocus !== true) return item.onSelect
  return () => {
    taken.current = true
    setTimeout(item.onSelect, 0)
  }
}

const line =
  'relative grid w-full cursor-pointer grid-cols-[1rem_1fr_auto] items-center gap-[0.6875rem] px-3.5 py-[0.4375rem] text-left text-muted-foreground outline-none select-none data-highlighted:bg-linear-to-r data-highlighted:from-foreground/8 data-highlighted:to-foreground/3 data-highlighted:text-foreground data-disabled:pointer-events-none data-disabled:opacity-40 pointer-coarse:min-h-11 [&_svg]:size-[0.9375rem] [&_svg]:stroke-[1.4] [&_svg]:text-faint data-highlighted:[&_svg]:text-foreground'

// The line between two groups of entries.
const rule = 'my-1.5 h-px bg-linear-to-r from-border to-transparent'

const tones = {
  agent: 'text-agent [&_svg]:text-agent data-highlighted:text-agent',
  destructive:
    'text-destructive data-highlighted:bg-linear-to-r data-highlighted:from-destructive/14 data-highlighted:to-transparent data-highlighted:text-destructive [&_svg]:text-destructive data-highlighted:[&_svg]:text-destructive',
} as const

/** A line's voice: the agent's violet, the destructive red, or the menu's own. */
const toneOf = (item: MenuItem | undefined) =>
  item?.tone === undefined ? undefined : tones[item.tone]

function Lines({ entries }: { entries: readonly MenuEntry[] }) {
  return entries.map((entry, index) => <Entry key={index} entry={entry} index={index} />)
}

function Entry({ entry, index }: { entry: MenuEntry; index: number }) {
  const { parts } = useContext(KitContext)
  const taken = useContext(FocusTaken)
  if (entry === 'separator') {
    return <parts.Separator className={rule} />
  }
  if (isToggle(entry)) {
    return (
      <parts.CheckboxItem
        checked={entry.checked}
        onCheckedChange={entry.onCheckedChange}
        onSelect={(event) => {
          // A setting stays in its menu, so the next one can be changed too.
          event.preventDefault()
        }}
        className={cn(line, 'group')}
      >
        <span className="grid place-items-center">{entry.icon}</span>
        <span>{entry.label}</span>
        <span
          aria-hidden="true"
          className="relative h-3 w-[1.375rem] bg-muted transition-colors group-data-[state=checked]:bg-human/35 after:absolute after:top-0.5 after:left-0.5 after:size-2 after:bg-faint after:transition-transform after:duration-200 after:content-[''] group-data-[state=checked]:after:translate-x-2.5 group-data-[state=checked]:after:bg-human"
        />
      </parts.CheckboxItem>
    )
  }
  if (isSubmenu(entry)) return <Submenu entry={entry} index={index} />
  return (
    <parts.Item
      data-entry={index}
      onSelect={selected(entry, taken)}
      disabled={entry.disabled}
      aria-keyshortcuts={entry.shortcut && ariaShortcut(entry.shortcut)}
      className={cn(line, toneOf(entry))}
    >
      <LineWords {...entry} />
    </parts.Item>
  )
}

/** A line's icon, its words and, at its end, its key, and a chevron where it opens a submenu. */
function LineWords({
  icon,
  label,
  shortcut,
  opens = false,
}: {
  icon?: ReactNode
  label: string
  shortcut?: Shortcut | undefined
  opens?: boolean
}) {
  return (
    <>
      <span className="grid place-items-center">{icon}</span>
      <span>{label}</span>
      <span className="flex items-center gap-2 text-faint">
        {shortcut !== undefined && <Keys shortcut={shortcut} />}
        {opens && <ChevronRight aria-hidden className="size-3! opacity-60" />}
      </span>
    </>
  )
}

/** A line that opens a menu beside it, never over what the menu acts on. */
function Submenu({ entry, index }: { entry: MenuSubmenu; index: number }) {
  const kit = useContext(KitContext)
  const { parts } = kit
  const { submenu } = entry
  return (
    <parts.Sub>
      <parts.SubTrigger
        data-entry={index}
        aria-keyshortcuts={entry.shortcut && ariaShortcut(entry.shortcut)}
        className={line}
      >
        <LineWords {...entry} opens />
      </parts.SubTrigger>
      <parts.Portal>
        <parts.SubContent
          aria-label={submenu.label}
          sideOffset={2}
          alignOffset={-6}
          collisionPadding={12}
          {...keysOf(submenu.entries ?? [])}
          className={cn(surface, kit.origin)}
        >
          {submenu.picture}
          {submenu.entries !== undefined && <Lines entries={submenu.entries} />}
        </parts.SubContent>
      </parts.Portal>
    </parts.Sub>
  )
}

interface MenuChoiceProps {
  /** What choosing it does, for a screen reader. */
  label: string
  onSelect: () => void
  /** Told when it is lit and when it is no longer, by the pointer or the keyboard. */
  onHighlight?: (lit: boolean) => void
  /** What it is drawn as: an element that takes a ref, focus and a role, an SVG group included. */
  children: ReactElement
}

/**
 * One choice of a picture inside a menu, a place in a frame: a line of the menu as the keyboard and a
 * screen reader take it, ↑ and ↓ reaching it, Enter choosing it, drawn as its caller draws it.
 */
export function MenuChoice({ label, onSelect, onHighlight, children }: MenuChoiceProps) {
  const { parts } = useContext(KitContext)
  return (
    <parts.Item
      asChild
      aria-label={label}
      onSelect={onSelect}
      onFocus={() => onHighlight?.(true)}
      onBlur={() => onHighlight?.(false)}
      ref={clickable}
    >
      {children}
    </parts.Item>
  )
}

// Radix runs a highlighted line on Enter by calling its `click()`, which an SVG element lacks: the
// choice gets one that sends the click its line listens to.
function clickable(element: Element | null) {
  if (element && !(element instanceof HTMLElement)) {
    Object.assign(element, {
      click: () => element.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    })
  }
}

/**
 * A menu held open where it is drawn, for /design-system: its header and its lines as the menu shows
 * them, nothing to choose. A list for a screen reader, each line and its key.
 */
export function MenuDrawn({
  label,
  header,
  entries,
}: {
  label: string
  header?: MenuHeader
  entries: readonly MenuEntry[]
}) {
  return (
    <div role="group" aria-label={label} className={cn(surface, 'w-max')}>
      {header !== undefined && <Header {...header} />}
      <ul>
        {entries.map((entry, index) => {
          if (entry === 'separator') {
            return <li key={index} aria-hidden className={rule} />
          }
          const shortcut = shortcutOf(entry)
          const item = isToggle(entry) || isSubmenu(entry) ? undefined : entry
          return (
            <li
              key={index}
              aria-keyshortcuts={shortcut && ariaShortcut(shortcut)}
              // Marked as Radix marks a disabled line, so the line's own look dims it.
              data-disabled={item?.disabled === true ? '' : undefined}
              className={cn(line, 'cursor-default', toneOf(item))}
            >
              <LineWords
                icon={entry.icon}
                label={entry.label}
                shortcut={shortcut}
                opens={isSubmenu(entry)}
              />
            </li>
          )
        })}
      </ul>
    </div>
  )
}
