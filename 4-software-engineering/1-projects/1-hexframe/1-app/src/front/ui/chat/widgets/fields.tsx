// The widgets' fields: one underline each, never a box (the direction's second principle). The line
// draws itself in the widget's voice from the left as the field takes the focus, glowing a little, and
// turns destructive while the field is refused. Above it a quiet label, a dot after it once the field
// was changed, and its count near its limit; under it what was refused, said as it changes. Every
// field is controlled: what it holds is its widget's caller's.
import { cn } from 'cn'
import { useId, type ReactNode, type Ref } from 'react'

import { countOf, type CountTone } from './count'

interface FieldProps {
  label: string
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
  fieldRef?: Ref<HTMLInputElement & HTMLTextAreaElement>
}

const countTones: Record<CountTone, string> = {
  quiet: 'text-muted-foreground',
  near: 'text-warning',
  over: 'text-destructive',
}

/** A labelled field on one underline, its count near its limit and its refusal under it. */
export function Field({
  label,
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
  fieldRef,
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
    className: cn(
      'block w-full border-0 border-b border-input bg-transparent pt-1 pb-1.5 text-foreground caret-(--voice) outline-none placeholder:text-muted-foreground',
      look === 'prose'
        ? 'min-h-26 font-human text-base leading-[1.55] font-light'
        : 'text-sm font-light',
      look !== 'line' && 'field-sizing-content max-h-80 resize-none',
    ),
  }
  return (
    <div className="grid content-start gap-1">
      <div className="flex items-baseline justify-between gap-3 text-[0.71875rem] text-muted-foreground">
        <label htmlFor={id} className={cn(edited && editedDot)}>
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
            <input ref={fieldRef} type={type} {...control} />
          ) : (
            <textarea ref={fieldRef} rows={look === 'prose' ? 4 : 3} {...control} />
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
  fieldRef?: Ref<HTMLInputElement>
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
  fieldRef,
}: TitleFieldProps) {
  const errorId = useId()
  const invalid = error !== undefined
  return (
    <div className="grid gap-1">
      <input
        ref={fieldRef}
        value={value}
        aria-label={label}
        placeholder={placeholder}
        autoComplete="off"
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        onChange={(event) => {
          onChange(event.target.value)
        }}
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

interface ChoiceProps<T extends string> {
  /** The group's name, for a screen reader: "Kind". */
  label: string
  choices: ReadonlyArray<{ readonly id: T; readonly label: string }>
  on: T
  onChoose: (id: T) => void
  /** What the choice on means, in a few words after the choices. */
  means?: string
  className?: string
}

/** A few words to choose among, the one on underlined in the voice, what it means after them. */
export function Choice<T extends string>({
  label,
  choices,
  on,
  onChoose,
  means,
  className,
}: ChoiceProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('flex flex-wrap items-baseline gap-x-4 gap-y-1', className)}
    >
      {choices.map((choice) => (
        <button
          key={choice.id}
          type="button"
          aria-pressed={choice.id === on}
          onClick={() => {
            onChoose(choice.id)
          }}
          className="cursor-pointer border-b border-transparent py-0.5 text-[0.78125rem] text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-(--voice) aria-pressed:border-(--voice) aria-pressed:text-foreground pointer-coarse:min-h-11"
        >
          {choice.label}
        </button>
      ))}
      {means !== undefined && (
        <span className="text-xs font-light text-muted-foreground">{means}</span>
      )}
    </div>
  )
}
