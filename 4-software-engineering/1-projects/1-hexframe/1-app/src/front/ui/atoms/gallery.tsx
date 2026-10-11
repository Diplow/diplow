// The atoms every side shares, on /design-system: the controls, the forms, the menu, the toasts, the
// skeleton, the theme and the language.
import { Copy, MoreHorizontal, Pencil, Plus, Share2, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'

import { m } from '#/paraglide/messages'

import { GallerySection, GalleryState } from '../gallery/frame'
import { Button } from './controls/button'
import { Input } from './controls/input'
import { LocaleSwitch } from './controls/LocaleSwitch'
import { Textarea } from './controls/textarea'
import { ThemeToggle } from './controls/ThemeToggle'
import { DropdownMenu, type MenuEntry } from './DropdownMenu'
import { Field } from './forms/field'
import { openedOnRefusal, useAppForm } from './forms/form'
import { Skeleton } from './skeleton'
import { toast } from './Toaster'

const variants = ['default', 'secondary', 'outline', 'ghost', 'link', 'destructive'] as const
const sizes = ['xs', 'sm', 'default', 'lg'] as const

export function AtomsGallery() {
  return (
    <>
      <ControlsGallery />
      <MenuGallery />
      <FeedbackGallery />
      <SettingsGallery />
    </>
  )
}

function ControlsGallery() {
  return (
    <>
      <GallerySection name="Button">
        <GalleryState label={m.gallery_state_variants()}>
          <div className="flex flex-wrap gap-2">
            {variants.map((variant) => (
              <Button key={variant} variant={variant}>
                {variant}
              </Button>
            ))}
          </div>
        </GalleryState>
        <GalleryState label={m.gallery_state_sizes()}>
          <div className="flex flex-wrap items-center gap-2">
            {sizes.map((size) => (
              <Button key={size} size={size} variant="outline">
                {size}
              </Button>
            ))}
            <Button size="icon" variant="outline" aria-label={m.gallery_sample_new_tile()}>
              <Plus />
            </Button>
          </div>
        </GalleryState>
        <GalleryState label={m.gallery_state_with_icon()}>
          <Button>
            <Plus />
            {m.gallery_sample_new_tile()}
          </Button>
        </GalleryState>
        <GalleryState label={m.gallery_state_disabled()}>
          <Button disabled>{m.gallery_sample_save()}</Button>
        </GalleryState>
      </GallerySection>
      <GallerySection name="Input">
        <TextControls render={(props) => <Input className="w-56" {...props} />} />
        <GalleryState label={m.gallery_state_password()}>
          <Input
            className="w-56"
            type="password"
            aria-label={m.gallery_state_password()}
            defaultValue="correct horse"
          />
        </GalleryState>
      </GallerySection>
      <GallerySection name="Textarea">
        <TextControls render={(props) => <Textarea className="w-56" {...props} />} />
      </GallerySection>
      <GallerySection name="Field">
        <GalleryState label={m.gallery_state_default()}>
          <div className="w-64">
            <Field label={m.gallery_form_title()} description={m.gallery_form_title_description()}>
              <Input placeholder={m.gallery_form_title_placeholder()} />
            </Field>
          </div>
        </GalleryState>
        <GalleryState label={m.gallery_state_invalid()}>
          <div className="w-64">
            <Field label={m.gallery_form_title()} errors={[m.gallery_form_title_required()]}>
              <Input />
            </Field>
          </div>
        </GalleryState>
      </GallerySection>
      <GallerySection name="useAppForm">
        <GalleryState label={m.gallery_form_hint({ limit: previewLimit })}>
          <TileForm />
        </GalleryState>
        <GalleryState label={m.gallery_form_refused()}>
          <TileForm refused={{ title: m.gallery_form_title_required() }} />
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
    {
      label: m.gallery_state_default(),
      props: { placeholder: m.gallery_form_title_placeholder() },
    },
    { label: m.gallery_state_filled(), props: { defaultValue: m.gallery_sample_tile_title() } },
    {
      label: m.gallery_state_disabled(),
      props: { defaultValue: m.gallery_sample_tile_title(), disabled: true },
    },
    { label: m.gallery_state_invalid(), props: { defaultValue: '', 'aria-invalid': true } },
  ]
  return states.map(({ label, props }) => (
    <GalleryState key={label} label={label}>
      {render({ 'aria-label': label, ...props })}
    </GalleryState>
  ))
}

const previewLimit = 350

/** A Tile's form; `refused`, the fields its last submit was refused on, which it opens showing. */
function TileForm({ refused }: { refused?: Record<string, string> }) {
  const form = useAppForm({
    defaultValues: { title: '', preview: '' },
    ...openedOnRefusal(refused),
    onSubmit: async ({ value }) => {
      await new Promise((resolve) => setTimeout(resolve, 800))
      toast.success(m.gallery_form_saved({ title: value.title }))
    },
  })
  const titleRequired = ({ value }: { value: string }) =>
    value.trim() === '' ? m.gallery_form_title_required() : undefined
  const previewShort = ({ value }: { value: string }) =>
    value.length > previewLimit
      ? m.gallery_form_preview_too_long({ limit: previewLimit })
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
            label={m.gallery_form_title()}
            placeholder={m.gallery_form_title_placeholder()}
          />
        )}
      </form.AppField>
      <form.AppField name="preview" validators={{ onChange: previewShort }}>
        {(field) => (
          <field.TextareaField
            label={m.gallery_form_preview()}
            description={m.gallery_form_preview_description({ limit: previewLimit })}
          />
        )}
      </form.AppField>
      <div>
        <form.AppForm>
          <form.SubmitButton>{m.gallery_sample_save()}</form.SubmitButton>
        </form.AppForm>
      </div>
    </form>
  )
}

const done = (what: string) => () => {
  toast(what)
}

// Messages are read at render, in the request's locale, never at module load.
const menuEntries = (): MenuEntry[] => [
  { label: m.gallery_sample_edit(), icon: <Pencil />, onSelect: done(m.gallery_sample_edit()) },
  {
    label: m.gallery_sample_copy_link(),
    icon: <Copy />,
    onSelect: done(m.gallery_sample_copy_link()),
  },
  {
    label: m.gallery_sample_share(),
    icon: <Share2 />,
    onSelect: done(m.gallery_sample_share()),
    disabled: true,
  },
  'separator',
  {
    label: m.gallery_sample_delete(),
    icon: <Trash2 />,
    onSelect: done(m.gallery_sample_delete()),
    destructive: true,
  },
]

function MenuGallery() {
  return (
    <GallerySection name="DropdownMenu">
      <GalleryState label={m.gallery_state_menu()}>
        <DropdownMenu
          label={m.gallery_sample_tile_title()}
          entries={menuEntries()}
          trigger={
            <Button variant="outline" size="icon" aria-label={m.gallery_sample_actions()}>
              <MoreHorizontal />
            </Button>
          }
        />
      </GalleryState>
    </GallerySection>
  )
}

const showLoading = () => {
  const id = toast.loading(m.gallery_toast_loading_message())
  setTimeout(() => toast.success(m.gallery_toast_success_message(), { id }), 1500)
}

function FeedbackGallery() {
  const toasts = [
    { label: m.gallery_toast_plain(), show: () => toast(m.gallery_toast_plain_message()) },
    {
      label: m.gallery_toast_success(),
      show: () => toast.success(m.gallery_toast_success_message()),
    },
    { label: m.gallery_toast_info(), show: () => toast.info(m.gallery_toast_info_message()) },
    {
      label: m.gallery_toast_warning(),
      show: () => toast.warning(m.gallery_toast_warning_message()),
    },
    { label: m.gallery_toast_error(), show: () => toast.error(m.gallery_toast_error_message()) },
    // A loading toast stays until it is settled; the demo settles it as a save would.
    { label: m.gallery_toast_loading(), show: showLoading },
  ]
  return (
    <>
      <GallerySection name="Toaster">
        <GalleryState label={m.gallery_state_click_to_show()}>
          <div className="flex flex-wrap gap-2">
            {toasts.map(({ label, show }) => (
              <Button key={label} variant="outline" onClick={show}>
                {label}
              </Button>
            ))}
          </div>
        </GalleryState>
      </GallerySection>
      <GallerySection name="Skeleton">
        <GalleryState label={m.gallery_state_loading()}>
          <div className="flex w-72 items-center gap-4">
            <Skeleton className="size-12 rounded-full" />
            <div className="grid flex-1 gap-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        </GalleryState>
      </GallerySection>
    </>
  )
}

// Both sit in every page's header too; here they change the page itself, as there.
function SettingsGallery() {
  return (
    <>
      <GallerySection name="ThemeToggle">
        <GalleryState label={m.gallery_state_click_to_switch()}>
          <ThemeToggle />
        </GalleryState>
      </GallerySection>
      <GallerySection name="LocaleSwitch">
        <GalleryState label={m.gallery_state_click_to_switch()}>
          <LocaleSwitch />
        </GalleryState>
      </GallerySection>
    </>
  )
}
