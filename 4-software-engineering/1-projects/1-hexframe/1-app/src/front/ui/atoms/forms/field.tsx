import { Label } from 'radix-ui'
import { cloneElement, useId, type ReactElement } from 'react'

interface ControlProps {
  id?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

interface FieldProps {
  label: string
  description?: string
  /** Messages to show under the control; any of them marks it invalid. */
  errors?: readonly string[]
  /** One control (Input, Textarea…): Field gives it its id and its aria wiring, over any of its own. */
  children: ReactElement<ControlProps>
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
      {cloneElement(children, {
        id,
        'aria-invalid': invalid || undefined,
        'aria-describedby': describedBy,
      })}
      {description && (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {invalid && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {errors.join(' ')}
        </p>
      )}
    </div>
  )
}
