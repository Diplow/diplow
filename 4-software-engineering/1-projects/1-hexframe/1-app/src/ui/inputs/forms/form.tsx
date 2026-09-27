import { createFormHook, createFormHookContexts } from '@tanstack/react-form'
import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '../controls/button'
import { Input } from '../controls/input'
import { Textarea } from '../controls/textarea'
import { errorMessages } from './errors'
import { Field } from './field'

const { fieldContext, formContext, useFieldContext, useFormContext } = createFormHookContexts()

interface TextFieldProps {
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

function TextField({ label, description, placeholder }: TextFieldProps) {
  const { errors, control } = useTextField()
  return (
    <Field label={label} description={description} errors={errors}>
      <Input placeholder={placeholder} {...control} />
    </Field>
  )
}

function TextareaField({ label, description, placeholder }: TextFieldProps) {
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
    <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
      {([canSubmit, isSubmitting]) => (
        <Button type="submit" disabled={!canSubmit || isSubmitting}>
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
