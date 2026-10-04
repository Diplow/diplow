import { createFormHook, createFormHookContexts } from '@tanstack/react-form'
import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '../controls/button'
import { Input } from '../controls/input'
import { Textarea } from '../controls/textarea'
import { errorMessages } from './errors'
import { Field } from './field'

const { fieldContext, formContext, useFieldContext, useFormContext } = createFormHookContexts()

interface TextareaFieldProps {
  label: string
  description?: string
  placeholder?: string
}

// A field shows its errors once the user has left it, or tried to submit.
function useTextField() {
  const field = useFieldContext<string>()
  const { isTouched, errors } = field.state.meta
  return {
    errors: isTouched ? errorMessages(errors) : [],
    control: {
      name: field.name,
      value: field.state.value,
      onBlur: field.handleBlur,
      onChange: (event: { target: { value: string } }) => {
        field.handleChange(event.target.value)
      },
    },
  }
}

interface TextFieldProps extends TextareaFieldProps {
  /** What the value is, so the browser offers the right keyboard and hides a password. */
  type?: 'text' | 'email' | 'password'
  /** What the browser may fill it with: `email`, `current-password`, `new-password`… */
  autoComplete?: string
}

function TextField({ label, description, placeholder, type, autoComplete }: TextFieldProps) {
  const { errors, control } = useTextField()
  return (
    <Field label={label} description={description} errors={errors}>
      <Input placeholder={placeholder} type={type} autoComplete={autoComplete} {...control} />
    </Field>
  )
}

function TextareaField({ label, description, placeholder }: TextareaFieldProps) {
  const { errors, control } = useTextField()
  return (
    <Field label={label} description={description} errors={errors}>
      <Textarea placeholder={placeholder} {...control} />
    </Field>
  )
}

function SubmitButton({ children }: { children: ReactNode }) {
  const form = useFormContext()
  return (
    // Enabled while the form is invalid: a submit attempt is what shows every field's error.
    <form.Subscribe selector={(state) => state.isSubmitting}>
      {(isSubmitting) => (
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          {children}
        </Button>
      )}
    </form.Subscribe>
  )
}

/**
 * The one way to build a form: TanStack Form, with the design system's fields (`form.AppField` renders
 * `field.TextField` or `field.TextareaField`) and its submit button (`form.SubmitButton` inside `form.AppForm`).
 */
export const { useAppForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: { TextField, TextareaField },
  formComponents: { SubmitButton },
})
