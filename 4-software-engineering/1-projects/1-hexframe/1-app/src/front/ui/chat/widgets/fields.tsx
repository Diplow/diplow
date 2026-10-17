// The widgets' fields: one underline each, never a box (the direction's second principle). The line
// draws itself in the widget's voice from the left as the field takes the focus, glowing a little, and
// turns destructive while the field is refused. Above it a quiet label, a dot after it once the field
// was changed, and its count near its limit; under it what was refused, said as it changes. A field
// that reaches the chat's lines' end runs on to the curve at its height, its line and its count with
// it; one beside another stays in its place. Every field is controlled: what it holds is its widget's
// caller's.
import { cn } from 'cn'
import { useId, type KeyboardEvent, type ReactNode } from 'react'

import { runsToCurve, toCurve } from '../../layouts/screen/state/useAlongCurve'
import { countOf, type CountTone } from './count'

interface FieldProps {
  label: string
  /** Its label said to a screen reader alone, where the widget's question says it already. */
  labelHidden?: boolean
  value: string
  onChange: (value: string) => void
  /** Why it was refused, under it; marks it invalid. */
  error?: string | undefined
  /** What it takes, under it, quiet, until a refusal says it instead: "Between 8 and 128 characters." */
  hint?: string | undefined
  /** Changed since it was read: a small dot in the voice after its label, so Save says what it sends. */
  edited?: boolean
  /** The most it holds, counted as a reader counts: its count shows from four fifths of it. */
  limit?: number
  /**
   * `line`, an input in the interface's type; `text`, a textarea in it; `prose`, a textarea in the
   * user's serif, for what they write at length: a tile's page.
   */
  look?: 'line' | 'text' | 'prose'
  type?: 'text' | 'email' | 'password'
  autoComplete?: string
  placeholder?: string
  /** At the label's end, before the count: a page's Write and Preview. */
  aside?: ReactNode
  /** Shown in the control's place while it is set: the page read as it will be. */
  shown?: ReactNode
  /**
   * Enter alone validates it, Shift+Enter still breaking a line where it holds several: the widget
   * goes on to what comes next.
   */
  onEnter?: (() => void) | undefined
  /** It takes the focus as it comes, shown by the step the user just took. */
  takesFocus?: boolean
}

/** Enter alone, not while a word is composed: what validates a field that says what Enter does. */
function enterOf(onEnter: (() => void) | undefined) {
  if (onEnter === undefined) return undefined
  return (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.metaKey || event.ctrlKey) return
    if (event.altKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    onEnter()
  }
}

const countTones: Record<CountTone, string> = {
  quiet: 'text-muted-foreground',
  near: 'text-warning',
  over: 'text-destructive',
}

/** A labelled field on one underline, its count near its limit and its refusal under it. */
export function Field({
  label,
  labelHidden = false,
  value,
  onChange,
  error,
  hint,
  edited = false,
  limit,
  look = 'line',
  type = 'text',
  autoComplete,
  placeholder,
  aside,
  shown,
  onEnter,
  takesFocus = false,
}: FieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const count = limit === undefined ? undefined : countOf(value, limit)
  const invalid = error !== undefined
  const describedBy = invalid ? errorId : hint === undefined ? undefined : hintId
  const control = {
    id,
    value,
    placeholder,
    autoComplete,
    'aria-invalid': invalid || undefined,
    'aria-describedby': describedBy,
    onChange: (event: { target: { value: string } }) => {
      onChange(event.target.value)
    },
    onKeyDown: enterOf(onEnter),
    // Set only by a step the user just took, never on a page's first paint.
    autoFocus: takesFocus,
    className: cn(
      'block w-full border-0 border-b border-input bg-transparent pt-1 pb-1.5 text-foreground caret-(--voice) outline-none placeholder:text-muted-foreground',
      look === 'prose'
        ? 'min-h-26 font-human text-base leading-[1.55] font-light'
        : 'text-sm font-light',
      look !== 'line' && 'field-sizing-content max-h-80 resize-none',
    ),
  }
  return (
    <div ref={toCurve} className={cn(runsToCurve, 'grid content-start gap-1')}>
      <div
        className={cn(
          'flex items-baseline justify-between gap-3 text-[0.71875rem] text-muted-foreground',
          labelHidden && aside === undefined && count === undefined && 'sr-only',
        )}
      >
        <label htmlFor={id} className={cn(edited && editedDot, labelHidden && 'sr-only')}>
          {label}
        </label>
        <span className="flex items-baseline gap-3.5">
          {aside}
          {count !== undefined && (
            // The count is for the eye: past the limit, the refusal under the field says it.
            <span aria-hidden className={cn('font-mono text-[0.65625rem]', countTones[count.tone])}>
              {count.length} / {count.limit}
            </span>
          )}
        </span>
      </div>
      <Underlined invalid={invalid}>
        {shown ??
          (look === 'line' ? (
            <input type={type} {...control} />
          ) : (
            <textarea rows={look === 'prose' ? 4 : 3} {...control} />
          ))}
      </Underlined>
      <p id={errorId} aria-live="polite" className="text-xs text-destructive empty:hidden">
        {error}
      </p>
      {hint !== undefined && !invalid && (
        <p id={hintId} className="text-xs font-light text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  )
}

/** Its dot, after the label: changed since it was read. */
const editedDot =
  "after:ml-[7px] after:inline-block after:size-[5px] after:rounded-full after:bg-(--voice) after:align-[1px] after:shadow-[0_0_6px_var(--voice)] after:content-['']"

/**
 * The line under a control, which draws itself in the voice from the left as the control takes the
 * focus, and stays drawn, destructive, while it is refused.
 */
function Underlined({ invalid, children }: { invalid: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        "relative after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-left after:scale-x-0 after:bg-(--voice) after:shadow-[0_0_10px_0_color-mix(in_oklab,var(--voice)_60%,transparent)] after:transition-transform after:duration-400 after:ease-glide after:content-[''] focus-within:after:scale-x-100 motion-reduce:after:transition-none",
        invalid && 'after:scale-x-100 after:bg-destructive after:shadow-none',
      )}
    >
      {children}
    </div>
  )
}

interface TitleFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string | undefined
  placeholder?: string
  /** It takes the focus as it comes, when what opened it is gone. */
  takesFocus?: boolean
  /** Enter validates it: the widget goes on to what comes next. */
  onEnter?: (() => void) | undefined
}

/**
 * A title written where it is read: in the user's serif at the widget's title size, underlined only
 * while the pointer is over it or the focus in it, its refusal under it.
 */
export function TitleField({
  label,
  value,
  onChange,
  error,
  placeholder,
  takesFocus = false,
  onEnter,
}: TitleFieldProps) {
  const errorId = useId()
  const invalid = error !== undefined
  return (
    <div className="grid gap-1">
      <input
        // Set only by a step the user just took, never on a page's first paint: the widget replaced the
        // act that had the focus.
        autoFocus={takesFocus}
        value={value}
        aria-label={label}
        placeholder={placeholder}
        autoComplete="off"
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        onChange={(event) => {
          onChange(event.target.value)
        }}
        onKeyDown={enterOf(onEnter)}
        className={cn(
          'block w-full border-0 border-b border-transparent bg-transparent pb-[3px] font-human text-[1.3125rem] leading-tight text-foreground caret-(--voice) transition-colors duration-250 outline-none placeholder:text-muted-foreground placeholder:italic hover:border-input focus:border-(--voice)',
          invalid && 'border-destructive hover:border-destructive',
        )}
      />
      <p id={errorId} aria-live="polite" className="text-xs text-destructive empty:hidden">
        {error}
      </p>
    </div>
  )
}
