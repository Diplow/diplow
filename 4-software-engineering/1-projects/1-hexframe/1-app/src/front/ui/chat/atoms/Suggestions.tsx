// A list of suggestions over the field it suggests for: what an input offers as the user types, a Tile
// to `@` in a Message. The field keeps the focus and the keys, and a press in it never closes the list;
// the list shows which suggestion is active and takes a click. The field names the list through
// `suggestionsField`, so a screen reader hears it as a combobox and the active suggestion as it moves.
import { cn } from 'cn'
import { Popover } from 'radix-ui'
import { type ReactElement, useEffect, useRef } from 'react'

import { inField } from './field'

/** One suggestion: its id, what it says, and what tells it apart, quieter. */
interface Suggestion {
  readonly id: string
  readonly label: string
  readonly detail?: string
}

interface SuggestionsProps {
  /** The list's id, which the field names (`suggestionsField`). */
  id: string
  /** What the list offers, for a screen reader. */
  label: string
  open: boolean
  suggestions: ReadonlyArray<Suggestion>
  /** The active suggestion, by its id. */
  active: string | undefined
  /** A suggestion clicked. */
  onPick: (id: string) => void
  /** The list closed from outside: a click away from the list and its field, or Escape. */
  onClose: () => void
  /** The field it suggests for, which it is laid out over; it must take a ref. */
  children: ReactElement
}

/** The id of a suggestion's option in its list. */
const optionId = (list: string, id: string) => `${list}-${id}`

/** What the field a list suggests for says of it: a combobox controlling the list, its active option. */
export const suggestionsField = (list: string, open: boolean, active: string | undefined) => ({
  role: 'combobox' as const,
  'aria-autocomplete': 'list' as const,
  'aria-expanded': open,
  'aria-controls': list,
  ...(open && active !== undefined && { 'aria-activedescendant': optionId(list, active) }),
})

export function Suggestions({
  id,
  label,
  open,
  suggestions,
  active,
  onPick,
  onClose,
  children,
}: SuggestionsProps) {
  const list = useRef<HTMLUListElement>(null)
  const field = useRef<HTMLDivElement>(null)
  // The active option stays in view as the arrows move it.
  useEffect(() => {
    if (active === undefined) return
    list.current?.querySelector(`#${CSS.escape(optionId(id, active))}`)?.scrollIntoView({
      block: 'nearest',
    })
  }, [id, active])
  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <Popover.Anchor asChild ref={field}>
        {children}
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={4}
          // The field keeps the focus, and the keys with it.
          onOpenAutoFocus={(event) => {
            event.preventDefault()
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
          }}
          // A press in the field is the user still typing, or moving the caret: no click away. With no
          // Trigger, Radix would read it as one, and the search would end for that `@`.
          onInteractOutside={(event) => {
            if (inField(field.current, event.target)) event.preventDefault()
          }}
          className="z-50 w-(--radix-popover-trigger-width) max-w-[min(24rem,90vw)] origin-(--radix-popover-content-transform-origin) animate-in rounded-md border bg-popover p-1 text-popover-foreground shadow-md fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
        >
          <ul
            ref={list}
            id={id}
            role="listbox"
            aria-label={label}
            className="max-h-64 overflow-y-auto"
          >
            {suggestions.map((suggestion) => (
              <li
                key={suggestion.id}
                id={optionId(id, suggestion.id)}
                role="option"
                aria-selected={suggestion.id === active}
                className={cn(
                  'grid cursor-default rounded-sm px-2 py-1.5 text-sm',
                  suggestion.id === active && 'bg-accent text-accent-foreground',
                )}
                // A press keeps the focus in the field; the click then picks.
                onMouseDown={(event) => {
                  event.preventDefault()
                }}
                onClick={() => {
                  onPick(suggestion.id)
                }}
              >
                <span className="truncate">{suggestion.label}</span>
                {suggestion.detail !== undefined && (
                  <span className="truncate text-xs text-muted-foreground">
                    {suggestion.detail}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
