// A tile written in the conversation, as a widget whose title is the tile's title: amber while the
// words are the user's. Its hex is the place: the frame the tile goes in, its slot lit, where the user
// clicked on the canvas, which says its kind too. Creating, the title alone beside it takes the focus;
// Enter there brings the preview, with its count, and Enter in the preview the page, in the user's
// serif, written or read, each the widget's whole width. Editing, each changed field carries a dot and Save
// sends only those; the tile changed meanwhile, the user's words stay, the widget says who changed
// what, and Enter decides nothing. A refused write comes back as it left, the user's words put back and
// the refusal on the field at fault. Once written, its receipt, the focus handed to it. Controlled: the
// words, the place and what each action does are its caller's.
import { Check, FolderInput, Maximize2, Pencil, Plus, Trash2, UserRound, X } from 'lucide-react'
import { useState } from 'react'

import { m } from '#/paraglide/messages'

import { Dialog } from '../../../layouts/Dialog'
import { UntilDecided } from '../../entries/Receipt'
import { Widget } from '../../layouts/Widget'
import type { MentionProps } from '../../text/Mention'
import { weave } from '../../text/words'
import { Field, TitleField } from '../fields'
import {
  Diff,
  fieldNames,
  PlaceMark,
  whereOf,
  type Segment,
  type TileField,
  type TilePlace,
  type TileWords,
} from './parts'

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
  /** Where it goes, as the user clicked it on the canvas: the tile it goes under, its kind, its place. */
  where: TilePlace
  /** Opened by the user's click on the canvas: its title takes the focus as it comes. */
  takesFocus?: boolean
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
  /** Where it stands; none for the Root, which stands under nothing, its hex a pencil. */
  where?: TilePlace | undefined
  /** The fields changed since the tile was read, each marked; Save sends these. */
  edited: readonly TileField[]
  onSave: () => void
  /** Deletes it, once the user confirms; how many tiles go below it. The Root has none. */
  onDelete?: { below: number; confirm: () => void } | undefined
  /**
   * It was the agent's draft, taken to edit: the kicker says so, and its title takes the focus as it
   * comes, since the Edit it that opened it is gone.
   */
  taken?: boolean
  changed?: Changed | undefined
}

/** Once a write is sent, the widget leaves its receipt: what was done, to which tile, where. */
interface Done {
  mode: 'done'
  /** `named`, the Root given the user's pseudo: the receipt says it is theirs. */
  did: 'created' | 'edited' | 'deleted' | 'named'
  /** The tile, named as the conversation names one: a click centers the canvas on it. */
  tile: MentionProps
  /** Where it stands; none for the Root. */
  where?: TilePlace | undefined
  at: Date
  onUndo?: (() => void) | undefined
  undone?: boolean
}

/**
 * A new account's first question, the agent's: the pseudo the user goes by, which names their own
 * tile, the Root, at the heart of their System.
 */
interface Naming {
  mode: 'name'
  name: string
  onNameChange: (name: string) => void
  /** Why the last pseudo was refused. */
  refused?: string | undefined
  onName: () => void
  /** Brings a vault in as the Root instead, an empty System's. */
  onImport?: (() => void) | undefined
  /** Asked as the account opens: its field takes the focus as it comes. */
  takesFocus?: boolean
}

type TileWidgetProps = Creating | Editing | Done | Naming

const did = {
  created: m.widget_tile_created,
  edited: m.widget_tile_edited,
  deleted: m.widget_tile_deleted,
}

/** A tile's widget: a new tile, an edit, or once written its receipt, the focus handed to it. */
export function TileWidget(props: TileWidgetProps) {
  return (
    <UntilDecided
      receipt={
        props.mode === 'done'
          ? {
              words: receiptWords(props),
              at: props.at,
              tone: 'human',
              onUndo: props.onUndo,
              undone: props.undone,
              dawning: props.did === 'named',
            }
          : undefined
      }
    >
      {props.mode === 'new' && <NewTile {...props} />}
      {props.mode === 'edit' && <EditTile {...props} />}
      {props.mode === 'name' && <NameRoot {...props} />}
    </UntilDecided>
  )
}

/** What a receipt says: what was done to which tile, where, the Root's own words for the Root. */
function receiptWords(done: Done) {
  const tile = { tile: done.tile }
  if (done.did === 'named') return weave(m.widget_tile_named, { tile })
  if (done.where === undefined) return weave(m.widget_tile_root_edited, { tile })
  return weave(did[done.did], { tile, where: whereOf(done.where) })
}

/**
 * The agent asks the pseudo the user goes by, which becomes their own tile; Enter takes it. It is
 * there to be answered: no tools, no way to put it off, and its field needs no label under the question.
 */
function NameRoot(props: Naming) {
  const { name, onNameChange, refused, onName, onImport, takesFocus = false } = props
  return (
    <Widget
      voice="agent"
      icon={<UserRound />}
      kicker={m.widget_tile_name_kicker()}
      title={m.widget_tile_name_title()}
      actions={[
        {
          label: m.widget_tile_name_take(),
          icon: <Check />,
          shortcut: { key: 'Enter', mod: true },
          submit: true,
          onSelect: onName,
        },
        ...(onImport === undefined
          ? []
          : [
              {
                label: m.widget_tile_name_import(),
                icon: <FolderInput />,
                onSelect: onImport,
                apart: true,
              },
            ]),
      ]}
      tools={false}
    >
      <Field
        takesFocus={takesFocus}
        label={m.widget_tile_name_field()}
        labelHidden
        placeholder={m.widget_tile_name_placeholder()}
        value={name}
        onChange={onNameChange}
        error={refused}
      />
    </Widget>
  )
}

/** How far a new tile's words go: its title alone, then its preview, then its page. */
type Reach = 'title' | 'preview' | 'body'

function NewTile(props: Creating) {
  const { where, onCreate, onImport, onCancel, words, takesFocus = false } = props
  // A tile written already, a refusal's put back, shows every field it holds words in.
  const [reach, setReach] = useState<Reach>(
    words.body !== '' ? 'body' : words.preview !== '' ? 'preview' : 'title',
  )
  return (
    <Widget
      voice="human"
      mark={<PlaceMark where={where} label={m.widget_tile_place()} />}
      title={words.title.trim() === '' ? m.system_add_title() : words.title}
      titleField={
        <Title
          {...props}
          takesFocus={takesFocus}
          onEnter={() => {
            setReach((at) => (at === 'title' ? 'preview' : at))
          }}
        />
      }
      actions={[
        {
          label: m.widget_tile_create(),
          icon: <Plus />,
          shortcut: { key: 'Enter', mod: true },
          onSelect: onCreate,
        },
        { label: m.ui_cancel(), icon: <X />, onSelect: onCancel },
        ...(onImport === undefined
          ? []
          : [
              {
                label: m.system_import_here(),
                icon: <FolderInput />,
                onSelect: onImport,
                apart: true,
              },
            ]),
      ]}
      settings={settingsOf(props)}
      onDismiss={onCancel}
    >
      {reach !== 'title' && (
        <div className="grid gap-[1.125rem]">
          <Words
            {...props}
            body={reach === 'body'}
            fresh
            onPreviewEnter={() => {
              setReach('body')
            }}
          />
        </div>
      )}
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
        {...(where === undefined
          ? { icon: <Pencil /> }
          : { mark: <PlaceMark where={where} label={m.widget_tile_place()} /> })}
        kicker={taken ? m.widget_tile_taken_kicker() : m.widget_tile_edit_kicker()}
        title={words.title}
        titleField={<Title {...props} takesFocus={taken} />}
        actions={
          changed === undefined
            ? [
                {
                  label: m.system_save(),
                  icon: <Check />,
                  shortcut: { key: 'Enter', mod: true },
                  submit: true,
                  onSelect: onSave,
                },
                { label: m.ui_cancel(), icon: <X />, onSelect: onCancel },
                ...(onDelete === undefined
                  ? []
                  : [
                      {
                        label: m.system_delete(),
                        icon: <Trash2 />,
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

/** The title, written where it is read; Enter there goes on, where the widget says what to. */
function Title({
  words,
  onWordsChange,
  refused,
  takesFocus = false,
  onEnter,
}: Form & { takesFocus?: boolean; onEnter?: () => void }) {
  return (
    <TitleField
      takesFocus={takesFocus}
      onEnter={onEnter}
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

interface WordsProps extends Form {
  edited?: readonly TileField[]
  /** The page shows too; a new tile's comes once its preview is validated. */
  body?: boolean
  /** A new tile's: each field takes the focus as it comes, the step the user took bringing it. */
  fresh?: boolean
  /** Enter in the preview, a new tile's: its page comes. */
  onPreviewEnter?: () => void
}

/** The preview, counted, then the page, written or read as it will be. */
function Words({
  words,
  onWordsChange,
  previewLimit,
  refused,
  edited = [],
  body = true,
  fresh = false,
  onPreviewEnter,
}: WordsProps) {
  const [reading, setReading] = useState(false)
  return (
    <>
      <Field
        takesFocus={fresh}
        onEnter={onPreviewEnter}
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
      {body && (
        <Field
          takesFocus={fresh}
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
      )}
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
