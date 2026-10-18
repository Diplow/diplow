// A Tile's forms, in the chat, as the tile widget draws them (ui's `TileWidget`): a new Tile, in the
// place the user clicked on the canvas, which says its kind, or a Tile's edit, the Root's included,
// which has no place to draw, then, once sent, the receipt the widget leaves, the focus handed to it.
// Each form is one widget from its first word to its receipt, so the receipt takes the form's focus.
// What the user writes is `useTileWordsState`'s; the write goes through Mapping's form submits, which
// answer at once, and its refusal comes back through the page (`useRefusalState`), the user's words
// put back and the refusal on its field.
import { useState } from 'react'

import {
  previewLimit,
  tileAt,
  type Slot,
  type System as FlatSystem,
} from '#/domains/mapping/entities'
import { useCreateTileSubmit, useEditTileSubmit } from '#/front/client/mapping/queries'
import type { MentionProps } from '#/front/ui/chat/text/Mention'
import type { TilePlace, TileWords } from '#/front/ui/chat/widgets/tile/parts'
import { TileWidget } from '#/front/ui/chat/widgets/tile/TileWidget'

import { editedOf, whereIn } from './place'
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
  /** Imports files into this slot instead; none once it is a receipt, nor on a System visited. */
  onImport?: (() => void) | undefined
}

/** A new Tile's form, in the slot it was opened on, then its receipt. */
export function NewTileWidget(props: NewTileProps) {
  const { formKey, refilled, receipt, system, parent, slot } = props
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
      takesFocus
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
  /** Where it stands: its parent, its kind and its place; none for the Root. */
  where: TilePlace | undefined
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

interface NameRootProps extends FormProps {
  /** The Root, untitled, as the page draws it. */
  root: Opened
  /** The pseudo typed so far, the page's, so the canvas shows it on the Root as it is typed. */
  name: string
  onNameChange: (name: string) => void
  /** Imports a vault as the Root instead, an empty System's; none otherwise. */
  onImport?: (() => void) | undefined
}

/**
 * A new account's first question: the pseudo the user goes by, sent as the Root's Title, so their own
 * tile carries it on the canvas at once; then its receipt. A blank pseudo sends nothing.
 */
export function NameRootWidget(props: NameRootProps) {
  const { formKey, receipt, root, name, onNameChange, onImport } = props
  const submit = useEditTileSubmit(root)
  if (receipt !== undefined) return <TileWidget {...done(receipt, props)} />
  return (
    <TileWidget
      mode="name"
      name={name}
      onNameChange={onNameChange}
      onName={() => {
        const title = name.trim()
        if (title === '') return
        props.onSent({
          key: formKey,
          session: { kind: 'name', root },
          did: 'named',
          tile: { id: submit({ title, preview: root.preview, body: root.body }), title },
          where: undefined,
          at: new Date(),
        })
      }}
      onImport={onImport}
      takesFocus
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
