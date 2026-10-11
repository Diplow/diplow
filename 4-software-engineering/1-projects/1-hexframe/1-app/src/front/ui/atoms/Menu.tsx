import { cn } from 'cn'
import { ContextMenu, DropdownMenu } from 'radix-ui'
import type { KeyboardEvent, ReactElement, ReactNode } from 'react'

import { ariaShortcut, Keys, pressed, type Shortcut } from './keys'

interface MenuItem {
  label: string
  icon?: ReactNode
  /** Shown at the line's end, so the menu teaches it; typed with the menu open, it runs the entry. */
  shortcut?: Shortcut
  onSelect: () => void
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

/** An entry, a setting that is on or off, or a line between two groups of them. */
export type MenuEntry = MenuItem | MenuToggle | 'separator'

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

const isToggle = (entry: MenuItem | MenuToggle): entry is MenuToggle => 'checked' in entry

/**
 * A list of actions on one thing, navigable with the keyboard: behind a control, or where the thing
 * is, by a right click, a long press or ⇧F10. Each line can carry its key, which runs it.
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
  // Typing an entry's key runs it: the line is clicked, so Radix selects it and closes the menu.
  // Taking the key first also keeps Radix's typeahead from moving the focus instead. A key a line
  // already took, Enter or Space on the highlighted one, runs that line alone.
  const runShortcut = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented) return
    const index = entries.findIndex(
      (entry) => entry !== 'separator' && !isToggle(entry) && pressed(entry.shortcut, event),
    )
    if (index === -1) return
    event.preventDefault()
    event.currentTarget.querySelector<HTMLElement>(`[data-entry="${String(index)}"]`)?.click()
  }
  const body = (kit: Kit) => (
    <>
      {header !== undefined && <Header {...header} />}
      {entries.map((entry, index) => (
        <Entry key={index} entry={entry} index={index} kit={kit} />
      ))}
    </>
  )

  if (opensOn === 'context') {
    return (
      <ContextMenu.Root onOpenChange={onOpenChange}>
        <ContextMenu.Trigger
          asChild
          onKeyDown={openByKeyboard}
          // A long press opens the menu, not the browser's own callout over the thing.
          className="[-webkit-touch-callout:none]"
        >
          {trigger}
        </ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Content
            aria-label={label}
            onKeyDown={runShortcut}
            className={cn(surface, 'origin-(--radix-context-menu-content-transform-origin)')}
          >
            {body(ContextMenu)}
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
          onKeyDown={runShortcut}
          className={cn(surface, 'origin-(--radix-dropdown-menu-content-transform-origin)')}
        >
          {body(DropdownMenu)}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

// ⇧F10 and the menu key open a context menu where its thing is. Browsers fire `contextmenu` for them
// at a corner of the page, or not at all: the key is taken, and the event sent at the thing's center.
function openByKeyboard(event: KeyboardEvent<HTMLElement>) {
  if (!((event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu')) return
  event.preventDefault()
  const box = event.currentTarget.getBoundingClientRect()
  event.currentTarget.dispatchEvent(
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
  'risen relative z-50 max-h-(--radix-popper-available-height) min-w-[13.75rem] overflow-y-auto py-1.5 text-[0.8125rem] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-[0.97] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.97] data-[state=open]:duration-150 motion-reduce:animate-none'

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

// The parts both menus share, so one entry draws the same behind a control and where its thing is.
type Kit = Pick<typeof DropdownMenu, 'Item' | 'CheckboxItem' | 'Separator'>

const line =
  'relative grid w-full cursor-pointer grid-cols-[1rem_1fr_auto] items-center gap-[0.6875rem] px-3.5 py-[0.4375rem] text-left text-muted-foreground outline-none select-none data-highlighted:bg-linear-to-r data-highlighted:from-foreground/8 data-highlighted:to-foreground/3 data-highlighted:text-foreground data-disabled:pointer-events-none data-disabled:opacity-40 pointer-coarse:min-h-11 [&_svg]:size-[0.9375rem] [&_svg]:stroke-[1.4] [&_svg]:text-faint data-highlighted:[&_svg]:text-foreground'

function Entry({ entry, index, kit }: { entry: MenuEntry; index: number; kit: Kit }) {
  if (entry === 'separator') {
    return <kit.Separator className="my-1.5 h-px bg-linear-to-r from-border to-transparent" />
  }
  if (isToggle(entry)) {
    return (
      <kit.CheckboxItem
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
      </kit.CheckboxItem>
    )
  }
  return (
    <kit.Item
      data-entry={index}
      onSelect={entry.onSelect}
      disabled={entry.disabled}
      aria-keyshortcuts={entry.shortcut && ariaShortcut(entry.shortcut)}
      className={cn(
        line,
        entry.tone === 'agent' && 'text-agent [&_svg]:text-agent data-highlighted:text-agent',
        entry.tone === 'destructive' &&
          'text-destructive data-highlighted:bg-linear-to-r data-highlighted:from-destructive/14 data-highlighted:to-transparent data-highlighted:text-destructive [&_svg]:text-destructive data-highlighted:[&_svg]:text-destructive',
      )}
    >
      <span className="grid place-items-center">{entry.icon}</span>
      <span>{entry.label}</span>
      <span className="text-faint">
        {entry.shortcut !== undefined && <Keys shortcut={entry.shortcut} />}
      </span>
    </kit.Item>
  )
}
