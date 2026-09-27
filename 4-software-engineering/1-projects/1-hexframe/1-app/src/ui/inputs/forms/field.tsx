import { Label, Slot } from 'radix-ui'
import { useId, type ReactElement } from 'react'

interface FieldProps {
  label: string
  description?: string
  /** Messages to show under the control; any of them marks it invalid. */
  errors?: readonly string[]
  /** One control (Input, Textarea…): Field gives it its id and its aria wiring. */
  children: ReactElement
}

/** A labelled control, with its description and its errors, announced to assistive technology. */
export function Field({ label, description, errors = [], children }: FieldProps) {
  const id = useId()
  const invalid = errors.length > 0
  const descriptionId = description ? `${id}-description` : undefined
  const errorId = invalid ? `${id}-error` : undefined
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined
  return (
    <div data-slot="field" data-invalid={invalid || undefined} className="group grid gap-2">
      <Label.Root
        htmlFor={id}
        className="text-sm leading-none font-medium select-none group-data-invalid:text-destructive"
      >
        {label}
      </Label.Root>
      <Slot.Root id={id} aria-invalid={invalid || undefined} aria-describedby={describedBy}>
        {children}
      </Slot.Root>
      {description && (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {invalid && (
        <p id={errorId} className="text-sm text-destructive">
          {errors.join(' ')}
        </p>
      )}
    </div>
  )
}
