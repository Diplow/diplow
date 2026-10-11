// A tile written in the conversation, as a widget whose title is the tile's title: amber while the
// words are the user's. Its hex is the place: the frame the tile goes in, its slot lit; creating, the
// free slots are dashed and a pick moves the tile there. Then the kind, the preview with its count, and
// the page, in the user's serif, written or read. Editing, each changed field carries a dot and Save
// sends only those; the tile changed meanwhile, the user's words stay, the widget says who changed
// what, and Enter decides nothing. A refused write comes back as it left, the user's words put back and
// the refusal on the field at fault. Once written, its receipt, the focus handed to it. Controlled: the
// words, the place and what each action does are its caller's.
import { Maximize2, Pencil } from 'lucide-react'
import { useState } from 'react'

import { m } from '#/paraglide/messages'

import { Dialog } from '../../../layouts/Dialog'
import { UntilDecided } from '../../entries/Receipt'
import { Widget } from '../../layouts/Widget'
import type { MentionProps } from '../../text/Mention'
import { weave } from '../../text/words'
import { Choice, Field, TitleField } from '../fields'
import type { Place } from '../Places'
import {
  fieldNames,
  kinds,
  PlaceMark,
  placeNames,
  whereOf,
  type TileField,
  type TileKind,
  type TilePlace,
  type TileWords,
} from './parts'
import { Diff, type Segment } from './Proposal'

interface Form {
  words: TileWords
  onWordsChange: (words: TileWords) => void
  /** The most characters a Preview holds, as a reader counts them: Mapping's, read by the caller. */
  previewLimit: number
  /** Why its last write was refused, on the field at fault; the words it sent are put back. */
  refused?: Partial<Record<TileField, string>> | undefined
  onCancel: () => void
  /** Gives the page the canvas's side of the screen, to write at length. */
  onExpand?: () => void
}

interface Creating extends Form {
  mode: 'new'
  /** Where it goes: the tile it goes under, its kind and its place among the free ones. */
  where: TilePlace
  onPlaceChange: (place: Place) => void
  onKindChange: (kind: TileKind) => void
  onCreate: () => void
  /** Imports a vault into this place instead. */
  onImport?: () => void
}

/** The tile changed while the user typed: who changed which fields, when, and the ways on. */
interface Changed {
  by: string
  fields: readonly TileField[]
  when: string
  onSaveOver: () => void
  onTakeTheirs: () => void
  /** What changed, field by field, once the user asked to compare. */
  compared?: ReadonlyArray<{ field: TileField; segments: readonly Segment[] }> | undefined
  onCompare: () => void
}

interface Editing extends Form {
  mode: 'edit'
  where: TilePlace
  /** The fields changed since the tile was read, each marked; Save sends these. */
  edited: readonly TileField[]
  onSave: () => void
  /** Deletes it, once the user confirms; how many tiles go below it. The Root has none. */
  onDelete?: { below: number; confirm: () => void } | undefined
  /** It was the agent's draft, taken to edit: the kicker says so. */
  taken?: boolean
  changed?: Changed | undefined
}

/** Once a write is sent, the widget leaves its receipt: what was done, to which tile, where. */
interface Done {
  mode: 'done'
  did: 'created' | 'edited' | 'deleted'
  /** The tile, named as the conversation names one: a click centers the canvas on it. */
  tile: MentionProps
  where: TilePlace
  at: Date
  onUndo?: (() => void) | undefined
  undone?: boolean
}

type TileWidgetProps = Creating | Editing | Done

const did = {
  created: m.widget_tile_created,
  edited: m.widget_tile_edited,
  deleted: m.widget_tile_deleted,
}

/** A tile's widget: a new tile, an edit, or once written its receipt, the focus handed to it. */
export function TileWidget(props: TileWidgetProps) {
  if (props.mode === 'done') {
    const { tile, where, at, onUndo, undone } = props
    return (
      <UntilDecided
        receipt={{
          words: weave(did[props.did], { tile: { tile }, where: whereOf(where) }),
          at,
          tone: 'human',
          onUndo,
          undone,
        }}
      >
        {null}
      </UntilDecided>
    )
  }
  return (
    <UntilDecided receipt={undefined}>
      {props.mode === 'new' ? <NewTile {...props} /> : <EditTile {...props} />}
    </UntilDecided>
  )
}

function NewTile(props: Creating) {
  const { where, onPlaceChange, onKindChange, onCreate, onImport, onCancel } = props
  return (
    <Widget
      voice="human"
      mark={
        <PlaceMark where={where} label={m.widget_tile_place()} onPick={onPlaceChange} picking />
      }
      kicker={m.widget_tile_new_kicker({ where: whereOf(where) })}
      title={props.words.title.trim() === '' ? m.system_add_title() : props.words.title}
      titleField={<Title {...props} />}
      actions={[
        {
          label: m.widget_tile_create(),
          shortcut: { key: 'Enter', mod: true },
          submit: true,
          onSelect: onCreate,
        },
        { label: m.ui_cancel(), onSelect: onCancel },
        ...(onImport === undefined
          ? []
          : [{ label: m.system_import_here(), onSelect: onImport, apart: true }]),
      ]}
      settings={settingsOf(props)}
      onDismiss={onCancel}
    >
      <div className="grid gap-[1.125rem]">
        <Choice
          label={m.widget_tile_kind()}
          choices={kinds.map((kind) => ({ id: kind.id, label: kind.label() }))}
          on={where.kind}
          onChoose={onKindChange}
          means={kinds.find((kind) => kind.id === where.kind)?.means()}
        />
        {/* A finger can't hit the map's small hexes: the free places, by name, at a thumb's size. */}
        <Choice
          label={m.widget_tile_place()}
          choices={where.free.map((place) => ({ id: place, label: placeNames[place]() }))}
          on={where.place}
          onChoose={onPlaceChange}
          className="hidden pointer-coarse:flex"
        />
        <Words {...props} />
      </div>
    </Widget>
  )
}

function EditTile(props: Editing) {
  const { where, edited, onSave, onDelete, onCancel, taken = false, changed, words } = props
  const [deleting, setDeleting] = useState(false)
  return (
    <>
      <Widget
        voice="human"
        mark={<PlaceMark where={where} label={m.widget_tile_place()} />}
        kicker={taken ? m.widget_tile_taken_kicker() : m.widget_tile_edit_kicker()}
        title={words.title}
        titleField={<Title {...props} />}
        actions={
          changed === undefined
            ? [
                {
                  label: m.system_save(),
                  shortcut: { key: 'Enter', mod: true },
                  submit: true,
                  onSelect: onSave,
                },
                { label: m.ui_cancel(), onSelect: onCancel },
                ...(onDelete === undefined
                  ? []
                  : [
                      {
                        label: m.system_delete(),
                        destructive: true,
                        apart: true,
                        onSelect: () => {
                          setDeleting(true)
                        },
                      },
                    ]),
              ]
            : // Someone else's change stands: each way on is a choice, none Enter's.
              [
                { label: m.widget_tile_save_over(), onSelect: changed.onSaveOver },
                { label: m.widget_tile_compare(), onSelect: changed.onCompare },
                { label: m.widget_tile_take_theirs(), onSelect: changed.onTakeTheirs, apart: true },
              ]
        }
        settings={settingsOf(props)}
        onDismiss={onCancel}
      >
        <div className="grid gap-[1.125rem]">
          {changed !== undefined && <ChangedMeanwhile changed={changed} />}
          <Words {...props} edited={edited} />
        </div>
      </Widget>
      {onDelete !== undefined && (
        <Dialog
          open={deleting}
          onOpenChange={setDeleting}
          kicker={m.widget_tile_delete_kicker()}
          title={m.system_delete_title({ title: words.title })}
          confirmLabel={
            onDelete.below === 0
              ? m.system_delete()
              : m.widget_tile_delete_count({ count: String(onDelete.below + 1) })
          }
          onConfirm={() => {
            setDeleting(false)
            onDelete.confirm()
          }}
        >
          {m.system_delete_description({ title: words.title })}
        </Dialog>
      )}
    </>
  )
}

/** The widget's settings: the page given more room, when its caller can. */
function settingsOf({ onExpand }: Form) {
  return onExpand === undefined
    ? []
    : [{ label: m.widget_tile_expand(), icon: <Maximize2 />, onSelect: onExpand }]
}

/** The title, written where it is read. */
function Title({ words, onWordsChange, refused }: Form) {
  return (
    <TitleField
      label={m.system_field_title()}
      placeholder={m.system_untitled()}
      value={words.title}
      onChange={(title) => {
        onWordsChange({ ...words, title })
      }}
      error={refused?.title}
    />
  )
}

/** The preview, counted, then the page, written or read as it will be. */
function Words({
  words,
  onWordsChange,
  previewLimit,
  refused,
  edited = [],
}: Form & { edited?: readonly TileField[] }) {
  const [reading, setReading] = useState(false)
  return (
    <>
      <Field
        label={m.system_field_preview()}
        look="text"
        limit={previewLimit}
        placeholder={m.widget_tile_preview_placeholder()}
        value={words.preview}
        onChange={(preview) => {
          onWordsChange({ ...words, preview })
        }}
        edited={edited.includes('preview')}
        error={refused?.preview}
      />
      <Field
        label={m.widget_tile_page()}
        look="prose"
        placeholder={m.widget_tile_page_placeholder()}
        value={words.body}
        onChange={(body) => {
          onWordsChange({ ...words, body })
        }}
        edited={edited.includes('body')}
        error={refused?.body}
        aside={<WriteOrRead reading={reading} onReadingChange={setReading} />}
        shown={reading ? <Page text={words.body} /> : undefined}
      />
    </>
  )
}

/** Write and Read, which switch the page in place, each to itself. */
function WriteOrRead({
  reading,
  onReadingChange,
}: {
  reading: boolean
  onReadingChange: (reading: boolean) => void
}) {
  return (
    <span role="group" aria-label={m.widget_tile_page()} className="flex gap-3.5">
      {[
        { label: m.widget_tile_write(), reads: false },
        { label: m.widget_tile_read(), reads: true },
      ].map(({ label, reads }) => (
        <button
          key={label}
          type="button"
          aria-pressed={reading === reads}
          onClick={() => {
            onReadingChange(reads)
          }}
          className="cursor-pointer text-muted-foreground outline-none hover:text-foreground focus-visible:underline focus-visible:underline-offset-4 aria-pressed:text-foreground pointer-coarse:min-h-11"
        >
          {label}
        </button>
      ))}
    </span>
  )
}

/** The page as it will be read; as written until the Markdown seam renders it. */
function Page({ text }: { text: string }) {
  return (
    <div className="min-h-26 pt-1 pb-1.5 font-human text-base leading-[1.55] font-light whitespace-pre-wrap text-foreground">
      {text === '' ? (
        <span className="text-muted-foreground">{m.widget_tile_nothing_yet()}</span>
      ) : (
        text
      )}
    </div>
  )
}

/** Who changed the tile while the user typed, and that their words are still here. */
function ChangedMeanwhile({ changed }: { changed: Changed }) {
  return (
    <div className="grid gap-3">
      <p
        role="status"
        className="grid grid-cols-[1rem_1fr] gap-2.5 border-y border-border py-[11px] text-[0.8125rem] leading-normal font-light text-muted-foreground [&_b]:font-normal [&_b]:text-foreground"
      >
        <Pencil className="mt-0.5 size-[0.9375rem] text-warning" aria-hidden />
        <span>
          <b>{changed.by}</b>{' '}
          {m.widget_tile_changed_meanwhile({
            fields: changed.fields
              .map((field) => fieldNames[field]().toLocaleLowerCase())
              .join(', '),
            when: changed.when,
          })}
        </span>
      </p>
      {changed.compared?.map(({ field, segments }) => (
        <Diff
          key={field}
          label={fieldNames[field]()}
          segments={segments}
          prose={field === 'body'}
        />
      ))}
    </div>
  )
}
