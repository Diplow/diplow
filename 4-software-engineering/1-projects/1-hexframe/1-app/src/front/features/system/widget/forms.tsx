// A Tile's forms, in the chat, as the tile widget draws them (ui's `TileWidget`): a new Tile, where it
// goes on the map of its parent's places, or a Tile's edit, then, once sent, the receipt the widget
// leaves, the focus handed to it. Each form is one widget from its first word to its receipt, so the
// receipt takes the form's focus. What the user writes is `useTileWordsState`'s; the write goes
// through Mapping's form submits, which answer at once, and its refusal comes back through the page
// (`useRefusalState`), the user's words put back and the refusal on its field. The Root has no place
// to draw, so its edit stays in the drawer, on the shared form, until a proposal draws it.
import { useState } from 'react'

import {
  previewLimit,
  tileAt,
  type Slot,
  type System as FlatSystem,
} from '#/domains/mapping/entities'
import {
  type TileContent,
  type TileSubmit,
  useCreateTileSubmit,
  useEditTileSubmit,
} from '#/front/client/mapping/queries'
import type { FormErrors } from '#/front/client/channels'
import { m } from '#/paraglide/messages'
import { openedOnRefusal, useAppForm } from '#/front/ui/atoms/forms/form'
import { Drawer } from '#/front/ui/canvas/layouts/Drawer'
import type { MentionProps } from '#/front/ui/chat/text/Mention'
import type { TilePlace, TileWords } from '#/front/ui/chat/widgets/tile/parts'
import { TileWidget } from '#/front/ui/chat/widgets/tile/TileWidget'

import type { Reopened } from '../state/useRefusalState'
import { editedOf, slotForKind, slotOf, whereIn } from './place'
import { type Refilled, useTileWordsState } from './state/useTileWordsState'
import type { Opened, Receipt } from './state/useTileWidgetsState'

/** What every form is given: what a refusal put back, its receipt once sent, and where it goes. */
interface FormProps {
  /** The form's key, which its receipt keeps, so the one widget goes from form to receipt. */
  formKey: string
  /** What its last write's refusal put back: the user's words, and the refusal on its field. */
  refilled: Refilled | undefined
  /** Its receipt, once sent; the widget is the form until then. */
  receipt: Receipt | undefined
  /** The System as the page shows it, flat: which places are free, which Tiles still stand. */
  system: FlatSystem
  onSent: (receipt: Omit<Receipt, 'kind'>) => void
  onCancel: () => void
  /** Centers the canvas on a Tile the receipt names. */
  onCenter: (id: string) => void
}

const blank: TileWords = { title: '', preview: '', body: '' }

interface NewTileProps extends FormProps {
  /** The Tile it goes under, its id and its Title as the canvas shows it. */
  parent: { id: string; title: string }
  slot: Slot
  /** Another place, or another kind, picked: the slot it now goes in; none once it is a receipt. */
  onSlotChange?: (slot: Slot) => void
  /** Imports files into this slot instead; none once it is a receipt. */
  onImport?: () => void
}

/** A new Tile's form, in the slot it was opened on, then its receipt. */
export function NewTileWidget(props: NewTileProps) {
  const { formKey, refilled, receipt, system, parent, slot, onSlotChange } = props
  const submit = useCreateTileSubmit({ parent: parent.id, slot })
  const { state, actions } = useTileWordsState(blank, refilled)
  if (receipt !== undefined) return <TileWidget {...done(receipt, props)} />
  const where = whereIn(system, parent, slot)
  return (
    <TileWidget
      mode="new"
      where={where}
      words={state.words}
      onWordsChange={actions.change}
      previewLimit={previewLimit}
      refused={state.refused}
      onPlaceChange={(place) => {
        onSlotChange?.(slotOf(where.kind, place))
      }}
      onKindChange={(kind) => {
        const next = slotForKind(system, parent.id, slot, kind)
        if (next !== undefined) onSlotChange?.(next)
      }}
      onCreate={() => {
        props.onSent({
          key: formKey,
          session: { kind: 'add', parent: parent.id },
          did: 'created',
          tile: { id: submit(state.words), title: state.words.title },
          where,
          at: new Date(),
        })
      }}
      onImport={props.onImport}
      onCancel={props.onCancel}
    />
  )
}

interface EditTileProps extends FormProps {
  tile: Opened
  /** Where it stands: its parent, its kind and its place. */
  where: TilePlace
  /** Deletes it, once the user confirms, with how many Tiles go below it; none once sent. */
  deleting?: { below: number; confirm: () => void } | undefined
}

/** A Tile's edit, each changed field marked, Save sending those, then its receipt. */
export function EditTileWidget(props: EditTileProps) {
  const { formKey, refilled, receipt, where, deleting } = props
  // The Tile as the form opened on it: what Save compares with, and the Version it names.
  const [opened] = useState(props.tile)
  const submit = useEditTileSubmit(opened)
  const read = { title: opened.title, preview: opened.preview, body: opened.body }
  const { state, actions } = useTileWordsState(read, refilled)
  if (receipt !== undefined) return <TileWidget {...done(receipt, props)} />
  const sent = (did: Receipt['did'], id: string, title: string) => {
    props.onSent({
      key: formKey,
      session: { kind: 'edit', opened },
      did,
      tile: { id, title },
      where,
      at: new Date(),
    })
  }
  return (
    <TileWidget
      mode="edit"
      where={where}
      words={state.words}
      onWordsChange={actions.change}
      previewLimit={previewLimit}
      refused={state.refused}
      edited={editedOf(state.words, read)}
      onSave={() => {
        sent('edited', submit(state.words), state.words.title)
      }}
      onDelete={
        deleting && {
          below: deleting.below,
          confirm: () => {
            deleting.confirm()
            sent('deleted', opened.id, opened.title)
          },
        }
      }
      onCancel={props.onCancel}
    />
  )
}

/**
 * The receipt a form leaves, the Tile named centering the canvas while it stands: the same
 * `TileWidget` the form was, given its receipt, so the focus the form held goes to it.
 */
function done(receipt: Receipt, { system, onCenter }: Pick<FormProps, 'system' | 'onCenter'>) {
  const { did, tile, where, at } = receipt
  const stands = did !== 'deleted' && tileAt(system, tile.id) !== undefined
  const named: MentionProps = {
    title: tile.title,
    ...(did === 'deleted' && { standing: 'gone' }),
    ...(stands && {
      onCenter: () => {
        onCenter(tile.id)
      },
    }),
  }
  return {
    mode: 'done',
    did,
    tile: named,
    where,
    at,
  } as const
}

interface RootFormProps {
  /** The Root, when its edit is under way; none closes the drawer. */
  root: Opened | undefined
  /** What a refusal put back, as the shared form shows it. */
  refilled: Reopened | undefined
  onSent: () => void
  onClose: () => void
}

/**
 * The Root's edit, in the drawer, on the shared form: the widget has no place to draw it in, until a
 * proposal draws the Root's widget (`hexframe-app-design-system-v1/decisions.md#DEC-38`).
 */
export function RootDrawer({ root, refilled, onSent, onClose }: RootFormProps) {
  return (
    <Drawer
      open={root !== undefined}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={root === undefined ? undefined : m.system_edit_title({ title: titled(root.title) })}
    >
      {root !== undefined && (
        // A refusal reopens its form afresh, keyed by its turn, with what the user typed.
        <RootForm
          key={String(refilled?.turn ?? '')}
          root={root}
          refilled={refilled}
          onSent={onSent}
        />
      )}
    </Drawer>
  )
}

/** The Root's Title as a reader sees it: untitled until the user names it. */
const titled = (title: string) => (title === '' ? m.system_untitled() : title)

function RootForm({
  root,
  refilled,
  onSent,
}: Pick<RootFormProps, 'refilled' | 'onSent'> & { root: Opened }) {
  const submit = useEditTileSubmit(root)
  const { title, preview, body } = root
  return (
    <TileForm
      defaults={refilled?.content ?? { title, preview, body }}
      shown={refilled?.shown}
      submit={submit}
      onSent={onSent}
    />
  )
}

interface TileFormProps {
  defaults: TileContent
  /** What the form shows of its last write's refusal, reopened by it: on the fields it names. */
  shown: FormErrors | undefined
  submit: TileSubmit
  onSent: () => void
}

/** A Tile's Title, Preview and Body. What each must be is Mapping's to say, on the field at fault. */
function TileForm({ defaults, shown, submit, onSent }: TileFormProps) {
  const form = useAppForm({
    defaultValues: defaults,
    onSubmit: ({ value }) => {
      submit(value)
      onSent()
    },
    // A form reopened by a refusal shows it as a refused submit would; a refusal on no field is in
    // its toast already.
    ...openedOnRefusal(shown !== undefined && 'fields' in shown ? shown.fields : undefined),
  })
  return (
    <form
      noValidate
      className="grid gap-4 pb-4"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <form.AppField name="title">
        {(field) => <field.TextField label={m.system_field_title()} />}
      </form.AppField>
      <form.AppField name="preview">
        {(field) => (
          <field.TextareaField
            label={m.system_field_preview()}
            description={m.system_field_preview_description()}
          />
        )}
      </form.AppField>
      <form.AppField name="body">
        {(field) => (
          <field.TextareaField
            label={m.system_field_body()}
            description={m.system_field_body_description()}
          />
        )}
      </form.AppField>
      <div>
        <form.AppForm>
          <form.SubmitButton>{m.system_save()}</form.SubmitButton>
        </form.AppForm>
      </div>
    </form>
  )
}
