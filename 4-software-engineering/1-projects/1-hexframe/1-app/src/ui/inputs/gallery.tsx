import { Plus } from 'lucide-react'
import type { ReactNode } from 'react'

import { m } from '#/paraglide/messages'

import { toast } from '../feedback/Toaster'
import { GallerySection, GalleryState } from '../gallery'
import { Button } from './controls/button'
import { Input } from './controls/input'
import { Textarea } from './controls/textarea'
import { Field } from './forms/field'
import { useAppForm } from './forms/form'

const variants = ['default', 'secondary', 'outline', 'ghost', 'link', 'destructive'] as const
const sizes = ['xs', 'sm', 'default', 'lg'] as const

export function InputsGallery() {
  return (
    <>
      <GallerySection name="Button">
        <GalleryState label={m.dev_ui_state_variants()}>
          <div className="flex flex-wrap gap-2">
            {variants.map((variant) => (
              <Button key={variant} variant={variant}>
                {variant}
              </Button>
            ))}
          </div>
        </GalleryState>
        <GalleryState label={m.dev_ui_state_sizes()}>
          <div className="flex flex-wrap items-center gap-2">
            {sizes.map((size) => (
              <Button key={size} size={size} variant="outline">
                {size}
              </Button>
            ))}
            <Button size="icon" variant="outline" aria-label={m.dev_ui_sample_new_tile()}>
              <Plus />
            </Button>
          </div>
        </GalleryState>
        <GalleryState label={m.dev_ui_state_with_icon()}>
          <Button>
            <Plus />
            {m.dev_ui_sample_new_tile()}
          </Button>
        </GalleryState>
        <GalleryState label={m.dev_ui_state_disabled()}>
          <Button disabled>{m.dev_ui_sample_save()}</Button>
        </GalleryState>
      </GallerySection>
      <GallerySection name="Input">
        <TextControls render={(props) => <Input className="w-56" {...props} />} />
      </GallerySection>
      <GallerySection name="Textarea">
        <TextControls render={(props) => <Textarea className="w-56" {...props} />} />
      </GallerySection>
      <GallerySection name="Field">
        <GalleryState label={m.dev_ui_state_default()}>
          <div className="w-64">
            <Field label={m.dev_ui_form_title()} description={m.dev_ui_form_title_description()}>
              <Input placeholder={m.dev_ui_form_title_placeholder()} />
            </Field>
          </div>
        </GalleryState>
        <GalleryState label={m.dev_ui_state_invalid()}>
          <div className="w-64">
            <Field label={m.dev_ui_form_title()} errors={[m.dev_ui_form_title_required()]}>
              <Input />
            </Field>
          </div>
        </GalleryState>
      </GallerySection>
      <GallerySection name="useAppForm">
        <GalleryState label={m.dev_ui_form_hint()}>
          <TileForm />
        </GalleryState>
      </GallerySection>
    </>
  )
}

interface TextControlProps {
  'aria-label': string
  placeholder?: string
  defaultValue?: string
  disabled?: boolean
  'aria-invalid'?: boolean
}

// Input and Textarea share their states: empty, filled, disabled, invalid.
function TextControls({ render }: { render: (props: TextControlProps) => ReactNode }) {
  const states = [
    { label: m.dev_ui_state_default(), props: { placeholder: m.dev_ui_form_title_placeholder() } },
    { label: m.dev_ui_state_filled(), props: { defaultValue: m.dev_ui_sample_tile_title() } },
    {
      label: m.dev_ui_state_disabled(),
      props: { defaultValue: m.dev_ui_sample_tile_title(), disabled: true },
    },
    { label: m.dev_ui_state_invalid(), props: { defaultValue: '', 'aria-invalid': true } },
  ]
  return states.map(({ label, props }) => (
    <GalleryState key={label} label={label}>
      {render({ 'aria-label': label, ...props })}
    </GalleryState>
  ))
}

const previewLimit = 350

function TileForm() {
  const form = useAppForm({
    defaultValues: { title: '', preview: '' },
    onSubmit: async ({ value }) => {
      await new Promise((resolve) => setTimeout(resolve, 800))
      toast.success(m.dev_ui_form_saved({ title: value.title }))
    },
  })
  const titleRequired = ({ value }: { value: string }) =>
    value.trim() === '' ? m.dev_ui_form_title_required() : undefined
  const previewShort = ({ value }: { value: string }) =>
    value.length > previewLimit
      ? m.dev_ui_form_preview_too_long({ limit: previewLimit })
      : undefined
  return (
    <form
      noValidate
      className="grid w-96 max-w-full gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <form.AppField name="title" validators={{ onChange: titleRequired, onSubmit: titleRequired }}>
        {(field) => (
          <field.TextField
            label={m.dev_ui_form_title()}
            placeholder={m.dev_ui_form_title_placeholder()}
          />
        )}
      </form.AppField>
      <form.AppField name="preview" validators={{ onChange: previewShort }}>
        {(field) => (
          <field.TextareaField
            label={m.dev_ui_form_preview()}
            description={m.dev_ui_form_preview_description({ limit: previewLimit })}
          />
        )}
      </form.AppField>
      <form.AppForm>
        <form.SubmitButton>{m.dev_ui_sample_save()}</form.SubmitButton>
      </form.AppForm>
    </form>
  )
}
