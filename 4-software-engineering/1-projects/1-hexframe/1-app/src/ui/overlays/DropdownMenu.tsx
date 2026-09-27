import { cn } from 'cn'
import { DropdownMenu as Menu } from 'radix-ui'
import type { ReactElement, ReactNode } from 'react'

interface MenuItem {
  label: string
  icon?: ReactNode
  onSelect: () => void
  /** Deletes or cannot be undone: shown in the destructive colour. */
  destructive?: boolean
  disabled?: boolean
}

/** A menu entry, or a line between two groups of them. */
export type MenuEntry = MenuItem | 'separator'

interface DropdownMenuProps {
  /** The control that opens the menu, a Button most often. */
  trigger: ReactElement
  /** A heading above the entries. */
  label?: string
  entries: readonly MenuEntry[]
  align?: 'start' | 'end'
}

/** A list of actions behind one control, navigable with the keyboard. */
export function DropdownMenu({ trigger, label, entries, align = 'start' }: DropdownMenuProps) {
  return (
    <Menu.Root>
      <Menu.Trigger asChild>{trigger}</Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align={align}
          sideOffset={4}
          className="z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          {label !== undefined && (
            <Menu.Label className="px-2 py-1.5 text-sm font-medium">{label}</Menu.Label>
          )}
          {entries.map((entry, index) =>
            entry === 'separator' ? (
              <Menu.Separator
                key={`separator-${String(index)}`}
                className="-mx-1 my-1 h-px bg-border"
              />
            ) : (
              <Menu.Item
                key={entry.label}
                onSelect={entry.onSelect}
                disabled={entry.disabled}
                className={cn(
                  "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
                  entry.destructive &&
                    'text-destructive focus:bg-destructive/10 focus:text-destructive dark:focus:bg-destructive/20 [&_svg]:!text-destructive',
                )}
              >
                {entry.icon}
                {entry.label}
              </Menu.Item>
            ),
          )}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )
}
