// What the user can do to the centered Tile: edit it, move it, export it, delete it, grow a Leaf into a
// Branch or shrink a bare Branch into a Leaf, and, on an empty System's Root, import a vault; a Leaf
// that isn't Markdown shows its Body as code. And the form a new Tile or an edited one is written in, or an import,
// in a drawer, where an empty slot offers a new Tile or an import. The drawer's open state and the
// move under way are the URL's. A write's change ends the moment it is sent: the drawer closes on
// submit, a delete centers the Tile it stood under. A refusal shows where its channel sends it: on the
// form's field, the form reopened with what the user typed (`useRefusalState`), in the import's
// report, or in a toast.
import {
  isContextSlot,
  isEmptySystem,
  isLeafSlot,
  type SystemTile,
} from '#/domains/mapping/entities'
import {
  useCreateTileSubmit,
  useDeleteTile,
  useEditTileSubmit,
  useExportTile,
  type TileContent,
  type TileSubmit,
} from '#/front/client/mapping/queries'
import type { FormErrors } from '#/front/client/channels'
import { m } from '#/paraglide/messages'
import { findTile, type TileNode } from '#/front/ui/hex/view/tiles'
import { centerOn, showView } from '#/front/ui/hex/view/view'
import { Button } from '#/front/ui/inputs/controls/button'
import { openedOnRefusal, useAppForm } from '#/front/ui/inputs/forms/form'
import { ConfirmDialog } from '#/front/ui/overlays/ConfirmDialog'
import { Drawer } from '#/front/ui/overlays/Drawer'
import { CodeBlock } from '#/front/ui/data/Markdown'
import { Card } from '#/front/ui/surfaces/Card'

import {
  changeOf,
  viewOf,
  withChange,
  withoutTile,
  withView,
  type Change,
  type SearchChange,
  type SystemSearch,
} from './search/search'
import { Import } from './import/Import'
import { type KindChange, useCenteredTileState } from './state/useCenteredTileState'
import { type Reopened, useRefusalState } from './state/useRefusalState'
import { tileIn } from './tree'

interface TileActionsProps {
  /** The System's Root, with everything below it. */
  system: SystemTile
  /** The System's Tiles as the canvas draws them (`canvasTree`). */
  tree: TileNode
  search: SystemSearch
  onSearchChange: (change: SearchChange) => void
}

export function TileActions({ system, tree, search, onSearchChange }: TileActionsProps) {
  const view = viewOf(search)
  const center = showView(tree, view).center
  // A broken Reference, centered, stands for no Tile: there is nothing to act on.
  const found = tileIn(system, center.id)
  const parent = found?.parent
  const { code, kindChange } = useCenteredTileState(system, center.id)
  const reopened = useRefusalState(search, onSearchChange)
  const remove = useDeleteTile()
  const begin = (change: Change) => {
    onSearchChange(withChange(search, change))
  }
  return (
    <>
      {found !== undefined && (
        <CenteredTile
          id={found.tile.id}
          title={center.title}
          description={
            parent === undefined
              ? isEmptySystem(system)
                ? m.system_root_empty_description()
                : m.system_root_description()
              : center.preview
          }
          code={code}
          kindChange={kindChange}
          onEdit={() => {
            begin({ kind: 'edit', id: found.tile.id })
          }}
          // The Root is the user: it neither moves nor goes.
          {...(parent !== undefined && {
            onMove: () => {
              begin({ kind: 'move', id: found.tile.id })
            },
            // The centered Tile goes at once, and everything below it: the view centers on the Tile
            // it stood under, and a change under way ends only if it named one of the Tiles gone.
            onDelete: () => {
              remove.mutate({ id: found.tile.id })
              onSearchChange((current) =>
                withoutTile(withView(current, centerOn(tree, parent.id)), center),
              )
            },
          })}
          // An empty System invites the user to start: its Root takes a whole vault.
          {...(isEmptySystem(system) && {
            onImport: () => {
              begin({ kind: 'import', place: { _tag: 'Root' } })
            },
          })}
        />
      )}
      <ChangeDrawer
        system={system}
        tree={tree}
        change={changeOf(search)}
        reopened={reopened}
        onChange={begin}
        // Closed, or sent: the change ends at once.
        onDone={() => {
          onSearchChange((current) => withChange(current, { kind: 'none' }))
        }}
      />
    </>
  )
}

interface CenteredTileProps {
  /** The centered Tile's id, which its export and its delete name. */
  id: string
  title: string
  description: string
  /** The Body shown as code under the title: a Leaf's that isn't Markdown. */
  code?: string | undefined
  /** Grows a Leaf into a Branch, or shrinks a Branch with nothing below it into a Leaf. */
  kindChange?: KindChange | undefined
  onEdit: () => void
  onMove?: () => void
  /** Deletes the Tile, once the user confirms; the Root, which is never deleted, has none. */
  onDelete?: () => void
  /** Opens a vault's import as the Root: an empty System's only. */
  onImport?: () => void
}

function CenteredTile({
  id,
  title,
  description,
  code,
  kindChange,
  onEdit,
  onMove,
  onDelete,
  onImport,
}: CenteredTileProps) {
  const exporting = useExportTile()
  return (
    <Card
      title={title}
      description={description === '' ? undefined : description}
      footer={
        <div className="flex flex-wrap gap-2">
          {onImport && (
            <Button size="sm" onClick={onImport}>
              {m.system_import_vault()}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onEdit}>
            {m.system_edit()}
          </Button>
          {onMove && (
            <Button variant="outline" size="sm" onClick={onMove}>
              {m.system_move()}
            </Button>
          )}
          {kindChange && (
            <Button
              variant="outline"
              size="sm"
              disabled={kindChange.pending}
              onClick={kindChange.change}
            >
              {kindChange.label}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={exporting.isPending}
            onClick={() => {
              exporting.mutate({ id })
            }}
          >
            {m.system_export()}
          </Button>
          {onDelete && (
            <ConfirmDialog
              trigger={
                <Button variant="outline" size="sm">
                  {m.system_delete()}
                </Button>
              }
              title={m.system_delete_title({ title })}
              description={m.system_delete_description({ title })}
              confirmLabel={m.system_delete()}
              destructive
              onConfirm={onDelete}
            />
          )}
        </div>
      }
    >
      {code !== undefined && <CodeBlock code={code} label={title} />}
    </Card>
  )
}

interface ChangeDrawerProps {
  system: SystemTile
  tree: TileNode
  change: Change
  /** The form a refusal reopened, the change under way's. */
  reopened: Reopened | undefined
  /** Turns the change into another: a new Tile into an import in the same slot, and back. */
  onChange: (change: Change) => void
  onDone: () => void
}

/** The drawer of the change under way, when it is a form: a new Tile's, an import, or a Tile's. */
function ChangeDrawer({ system, tree, change, reopened, onChange, onDone }: ChangeDrawerProps) {
  const form = drawerOf(system, tree, change)
  // A refusal reopens its form afresh, keyed by its turn, with what the user typed.
  const key = `${form?.key ?? ''}:${String(reopened?.turn ?? '')}`
  const slot = slotChoiceOf(change)
  // The choice stands above a new Tile's form, and above an import's pickers only, never its report.
  const choice =
    form !== undefined && slot !== undefined ? (
      <SlotChoice
        choice={change.kind}
        onChoose={(kind) => {
          onChange(slot[kind])
        }}
      />
    ) : undefined
  return (
    <Drawer
      open={form !== undefined}
      onOpenChange={(open) => {
        if (!open) onDone()
      }}
      title={form?.title}
      description={form?.description}
    >
      {form?.kind === 'add' && choice}
      {form?.kind === 'add' && (
        <NewTileForm
          key={key}
          parent={form.parent}
          slot={form.slot}
          refilled={reopened}
          onSent={onDone}
        />
      )}
      {form?.kind === 'import' && (
        <Import key={form.key} place={form.place} choice={choice} onDone={onDone} />
      )}
      {form?.kind === 'edit' && (
        <EditTileForm key={key} tile={form.tile} refilled={reopened} onSent={onDone} />
      )}
    </Drawer>
  )
}

/** What the drawer shows for a change; `undefined` when the change is no form, or names no Tile. */
function drawerOf(system: SystemTile, tree: TileNode, change: Change) {
  if (change.kind === 'add') {
    const parent = findTile(tree, change.parent)
    if (parent === undefined) return undefined
    return {
      kind: 'add',
      key: `${change.parent}:${JSON.stringify(change.slot)}`,
      title: m.system_add_title(),
      description: whereIn(change.slot, parent.title),
      parent: change.parent,
      slot: change.slot,
    } as const
  }
  if (change.kind === 'import') return importDrawerOf(tree, change.place)
  if (change.kind === 'edit') {
    const tile = tileIn(system, change.id)?.tile
    const node = findTile(tree, change.id)
    if (tile === undefined || node === undefined) return undefined
    return {
      kind: 'edit',
      key: tile.id,
      title: m.system_edit_title({ title: node.title }),
      description: undefined,
      tile,
    } as const
  }
  return undefined
}

/** What the drawer shows for an import: into a slot under a Tile it finds, or as the Root. */
function importDrawerOf(tree: TileNode, place: Extract<Change, { kind: 'import' }>['place']) {
  if (place._tag === 'Root') {
    return {
      kind: 'import',
      key: 'root',
      title: m.system_import_vault(),
      description: m.system_import_root_description(),
      place,
    } as const
  }
  const parent = findTile(tree, place.parent)
  if (parent === undefined) return undefined
  return {
    kind: 'import',
    key: `${place.parent}:${JSON.stringify(place.slot)}`,
    title: m.system_import_here(),
    description: whereIn(place.slot, parent.title),
    place,
  } as const
}

/** Where an empty slot stands, as its drawer says it: in a Tile's Context, a Leaf under it, or under it. */
function whereIn(slot: Extract<Change, { kind: 'add' }>['slot'], title: string) {
  if (isContextSlot(slot)) return m.system_add_in_context({ title })
  return isLeafSlot(slot) ? m.system_add_leaf_under({ title }) : m.system_add_under({ title })
}

/** What an empty slot offers, a new Tile or an import, each as the change it opens on that slot. */
function slotChoiceOf(change: Change) {
  const at =
    change.kind === 'add'
      ? { parent: change.parent, slot: change.slot }
      : change.kind === 'import' && change.place._tag === 'Slot'
        ? change.place
        : undefined
  if (at === undefined) return undefined
  return {
    add: { kind: 'add', parent: at.parent, slot: at.slot },
    import: { kind: 'import', place: { _tag: 'Slot', parent: at.parent, slot: at.slot } },
  } as const satisfies Record<string, Change>
}

interface SlotChoiceProps {
  choice: Change['kind']
  onChoose: (kind: 'add' | 'import') => void
}

/** The two things an empty slot takes, the one chosen pressed. */
function SlotChoice({ choice, onChoose }: SlotChoiceProps) {
  const options = [
    { kind: 'add', label: m.system_add_title() },
    { kind: 'import', label: m.system_import_here() },
  ] as const
  return (
    <div role="group" aria-label={m.system_import_choice()} className="mb-4 flex gap-2">
      {options.map(({ kind, label }) => (
        <Button
          key={kind}
          size="sm"
          variant={choice === kind ? 'secondary' : 'ghost'}
          aria-pressed={choice === kind}
          onClick={() => {
            onChoose(kind)
          }}
        >
          {label}
        </Button>
      ))}
    </div>
  )
}

/** What a Tile's form is given beside its write: a refusal's refill, and what follows its submit. */
interface FormOptions {
  /** The form reopened by its write's refusal, with what the user typed; none for a fresh one. */
  refilled: Reopened | undefined
  /** The form is sent: the drawer closes at once, as if the write had landed. */
  onSent: () => void
}

interface NewTileFormProps extends FormOptions {
  parent: string
  slot: Extract<Change, { kind: 'add' }>['slot']
}

function NewTileForm({ parent, slot, refilled, onSent }: NewTileFormProps) {
  const submit = useCreateTileSubmit({ parent, slot })
  return (
    <TileForm
      defaults={refilled?.content ?? { title: '', preview: '', body: '' }}
      shown={refilled?.shown}
      submit={submit}
      onSent={onSent}
      label={m.system_add()}
    />
  )
}

function EditTileForm({
  tile,
  refilled,
  onSent,
}: FormOptions & { tile: TileContent & { id: string } }) {
  const submit = useEditTileSubmit(tile)
  const { title, preview, body } = tile
  return (
    <TileForm
      defaults={refilled?.content ?? { title, preview, body }}
      shown={refilled?.shown}
      submit={submit}
      onSent={onSent}
      label={m.system_save()}
    />
  )
}

interface TileFormProps {
  defaults: TileContent
  /** What the form shows of its last write's refusal, reopened by it: on the fields it names. */
  shown: FormErrors | undefined
  submit: TileSubmit
  onSent: () => void
  label: string
}

/** A Tile's Title, Preview and Body. What each must be is Mapping's to say, on the field at fault. */
function TileForm({ defaults, shown, submit, onSent, label }: TileFormProps) {
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
          <form.SubmitButton>{label}</form.SubmitButton>
        </form.AppForm>
      </div>
    </form>
  )
}
