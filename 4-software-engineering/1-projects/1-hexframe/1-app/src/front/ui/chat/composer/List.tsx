// The list the composer opens upward from its top line, as wide as the conversation, running on to the
// curve across its height: what a `/` or an `@` finds, in groups, the row the user is on lit in their
// amber. The field keeps the focus and the keys (`Composer`); the list shows, follows the pointer and
// takes a click. Under a finger each row is a thumb's height and the keys' hints give way.
import { cn } from 'cn'
import { Check, type LucideIcon } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { m } from '#/paraglide/messages'

import { toCurve } from '../../layouts/screen/state/useAlongCurve'
import { cutAround } from '../atoms/cut'

/** A command: its icon, its name, what it takes and what it does. */
interface CommandRow {
  readonly kind: 'command'
  readonly id: string
  readonly name: string
  readonly takes?: string | undefined
  readonly does: string
  readonly icon: LucideIcon
}

/** A Tile: its Title and the Titles above it. */
interface TileRow {
  readonly kind: 'tile'
  readonly id: string
  readonly title: string
  readonly path: string
}

/** One of a few choices, a language: what it says, in its own language, and whether it is on. */
interface ChoiceRow {
  readonly kind: 'choice'
  readonly id: string
  readonly label: string
  readonly lang?: string | undefined
  readonly current?: boolean | undefined
}

export type Row = CommandRow | TileRow | ChoiceRow

/** What the list shows: what it offers, what was typed, its rows in groups, and its line when empty. */
export interface Listing {
  /** What the list offers, for a screen reader. */
  readonly label: string
  /** What was typed after the `/` or the `@`, marked in each row. */
  readonly typed: string
  readonly groups: ReadonlyArray<{ readonly label: string; readonly rows: ReadonlyArray<Row> }>
  /** Said when no row answers what was typed. */
  readonly none: string
  /** A note on the footer's right: what picking a row does. */
  readonly tip?: string | undefined
}

/** The id of a row's option in its list. */
export const optionId = (list: string, row: string) => `${list}-${row}`

interface ListProps {
  id: string
  listing: Listing
  /** The row the user is on, by its id. */
  active: string | undefined
  /** The pointer moved onto a row. */
  onHover: (row: string) => void
  onPick: (row: string) => void
}

export function List({ id, listing, active, onHover, onPick }: ListProps) {
  const rows = listing.groups.flatMap((group) => group.rows)
  const box = useRef<HTMLDivElement>(null)
  // The row the user is on stays in view as the arrows move it.
  useEffect(() => {
    if (active === undefined) return
    box.current?.querySelector(`#${CSS.escape(optionId(id, active))}`)?.scrollIntoView({
      block: 'nearest',
    })
  }, [id, active])
  return (
    <div
      ref={toCurve}
      className="absolute bottom-full left-0 right-[calc(var(--screen-foot-inset,0px)-var(--to-curve,0px))] z-30 flex max-h-[min(19rem,45dvh)] flex-col bg-popover text-popover-foreground shadow-lg before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-linear-to-r before:from-input before:to-input/30 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1.5"
    >
      <div
        ref={box}
        id={id}
        role="listbox"
        aria-label={listing.label}
        className="min-h-0 overflow-y-auto overscroll-contain py-2"
      >
        {listing.groups.map((group, index) => (
          <div key={group.label} role="group" aria-labelledby={`${id}-group-${String(index)}`}>
            <div
              id={`${id}-group-${String(index)}`}
              className="px-4 pt-2 pb-1 font-mono text-[0.65625rem] text-muted-foreground @wide:px-9"
            >
              {group.label}
            </div>
            {group.rows.map((row) => (
              <div
                key={row.id}
                id={optionId(id, row.id)}
                role="option"
                aria-selected={row.id === active}
                lang={row.kind === 'choice' ? row.lang : undefined}
                className={cn(
                  'group/row relative grid cursor-default items-baseline gap-3 px-4 py-1.5 @wide:px-9 pointer-coarse:min-h-11 pointer-coarse:items-center',
                  // The title or the name first; what tells it apart gives way.
                  'grid-cols-[1rem_minmax(0,auto)_minmax(0,1fr)]',
                  row.id === active &&
                    'bg-linear-to-r from-human/11 to-human/2 to-70% before:absolute before:inset-y-1.5 before:left-1.5 before:w-px before:bg-human @wide:before:left-5.5',
                )}
                // A press keeps the focus in the field; the click then picks.
                onMouseDown={(event) => {
                  event.preventDefault()
                }}
                onMouseMove={() => {
                  if (row.id !== active) onHover(row.id)
                }}
                onClick={() => {
                  onPick(row.id)
                }}
              >
                <RowContent row={row} typed={listing.typed} on={row.id === active} />
              </div>
            ))}
          </div>
        ))}
        {rows.length === 0 && (
          <p className="px-4 py-3 text-sm font-light text-muted-foreground @wide:px-9">
            {listing.none}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-2 text-xs font-light text-muted-foreground @wide:px-9 pointer-coarse:hidden">
        <Keys keys={['↑', '↓']} does={m.composer_keys_move()} />
        <Keys keys={['↵']} does={m.composer_keys_take()} />
        <Keys keys={['esc']} does={m.composer_keys_leave()} />
        {listing.tip !== undefined && (
          <span className="ml-auto max-w-full text-right">{listing.tip}</span>
        )}
      </div>
      {/* What the list holds now, said once it changes, since the focus stays in the field. */}
      <p aria-live="polite" className="sr-only">
        {rows.length === 0 ? listing.none : m.composer_list_count({ count: String(rows.length) })}
      </p>
    </div>
  )
}

function Keys({ keys, does }: { keys: ReadonlyArray<string>; does: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="flex gap-0.5">
        {keys.map((key) => (
          <kbd key={key} className="bg-muted px-1.5 py-0.5 text-[0.65625rem] text-muted-foreground">
            {key}
          </kbd>
        ))}
      </span>
      {does}
    </span>
  )
}

function RowContent({ row, typed, on }: { row: Row; typed: string; on: boolean }) {
  switch (row.kind) {
    case 'command':
      return <CommandContent row={row} typed={typed} on={on} />
    case 'tile':
      return <TileContent row={row} typed={typed} on={on} />
    case 'choice':
      return <ChoiceContent row={row} typed={typed} on={on} />
  }
}

function CommandContent({ row, typed, on }: { row: CommandRow; typed: string; on: boolean }) {
  const Icon = row.icon
  // What was typed shows where the name starts with it; a command found by its words shows none.
  const cut = cutAround(row.name, typed)
  const typedPart = cut?.before === '' ? cut.match : ''
  return (
    <>
      <Icon
        aria-hidden
        strokeWidth={1.4}
        className={cn('size-3.75 self-center', on ? 'text-foreground' : 'text-faint')}
      />
      <span
        className={cn(
          'font-mono text-[0.8125rem] whitespace-nowrap',
          on ? 'text-foreground' : 'text-foreground/80',
        )}
      >
        /<mark className="bg-transparent text-human">{typedPart}</mark>
        {row.name.slice(typedPart.length)}
        {row.takes !== undefined && <span className="ml-2 text-muted-foreground">{row.takes}</span>}
      </span>
      <span className="truncate text-right text-[0.78125rem] font-light text-muted-foreground">
        {row.does}
      </span>
    </>
  )
}

function TileContent({ row, typed, on }: { row: TileRow; typed: string; on: boolean }) {
  return (
    <>
      <svg
        aria-hidden
        viewBox="-10 -11 20 22"
        className={cn('size-4 self-center', on ? 'text-foreground' : 'text-faint')}
      >
        <polygon
          points="0,-10 8.66,-5 8.66,5 0,10 -8.66,5 -8.66,-5"
          className="fill-none stroke-current"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span
        className={cn(
          'truncate font-human text-[0.96875rem]',
          on ? 'text-foreground' : 'text-foreground/80',
        )}
      >
        <Highlighted text={row.title} typed={typed} />
      </span>
      <span className="truncate text-right text-[0.71875rem] font-light text-muted-foreground">
        {row.path}
      </span>
    </>
  )
}

function ChoiceContent({ row, typed, on }: { row: ChoiceRow; typed: string; on: boolean }) {
  return (
    <>
      {row.current === true ? (
        <Check aria-hidden strokeWidth={1.4} className="size-3.75 self-center text-human" />
      ) : (
        <span />
      )}
      <span className={on ? 'text-foreground' : 'text-foreground/80'}>
        <Highlighted text={row.label} typed={typed} />
      </span>
      {row.current === true && (
        <span className="text-right text-[0.71875rem] font-light text-muted-foreground">
          {m.composer_choice_current()}
        </span>
      )}
    </>
  )
}

/** A text, what was typed highlighted in it. */
function Highlighted({ text, typed }: { text: string; typed: string }) {
  const cut = cutAround(text, typed)
  if (cut === undefined) return text
  return (
    <>
      {cut.before}
      <mark className="bg-transparent text-foreground underline decoration-input underline-offset-3">
        {cut.match}
      </mark>
      {cut.after}
    </>
  )
}
