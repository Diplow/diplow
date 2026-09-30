// What the user can do to the centered Tile: edit it, move it, delete it; and the form a new Tile or an
// edited one is written in, in a drawer. The drawer's open state and the move under way are the URL's.
// A refusal shows where its channel sends it: on the form's field, or in a toast.
import {
  useCreateTileSubmit,
  useDeleteTile,
  useEditTileSubmit,
  type System,
  type TileContent,
} from '#/api/domains/mapping/queries'
import { m } from '#/paraglide/messages'
import type { TileNode } from '#/ui/hex/geometry/layout'
import { centerOn, findTile, showView, type CanvasView } from '#/ui/hex/view/view'
import { Button } from '#/ui/inputs/controls/button'
import { useAppForm } from '#/ui/inputs/forms/form'
import { ConfirmDialog } from '#/ui/overlays/ConfirmDialog'
import { Drawer } from '#/ui/overlays/Drawer'
import { Card } from '#/ui/surfaces/Card'

import { changeOf, viewOf, withChange, withView, type Change, type SystemSearch } from './search'
import { tileIn } from './tree'

interface TileActionsProps {
  system: System
  /** The System's Tiles as the canvas draws them (`canvasTree`). */
  tree: TileNode
  search: SystemSearch
  onSearchChange: (search: SystemSearch) => void
}

export function TileActions({ system, tree, search, onSearchChange }: TileActionsProps) {
  const view = viewOf(search)
  const center = showView(tree, view).center
  // A broken Reference, centered, stands for no Tile: there is nothing to act on.
  const found = tileIn(system, center.id)
  const begin = (change: Change) => {
    onSearchChange(withChange(search, change))
  }
  return (
    <>
      {found !== undefined && (
        <CenteredTile
          title={center.title}
          description={found.parent === undefined ? m.system_root_description() : center.preview}
          onEdit={() => {
            begin({ kind: 'edit', id: found.tile.id })
          }}
          // The Root is the user: it neither moves nor goes.
          {...(found.parent !== undefined && {
            onMove: () => {
              begin({ kind: 'move', id: found.tile.id })
            },
            deletion: {
              id: found.tile.id,
              // The centered Tile is gone: the view centers on the Tile it stood under.
              then: centerOn(tree, view, found.parent.id),
            },
          })}
          onViewChange={(next) => {
            onSearchChange(withChange(withView(search, next), { kind: 'none' }))
          }}
        />
      )}
      <ChangeDrawer
        system={system}
        tree={tree}
        change={changeOf(search)}
        onDone={() => {
          begin({ kind: 'none' })
        }}
      />
    </>
  )
}

interface CenteredTileProps {
  title: string
  description: string
  onEdit: () => void
  onMove?: () => void
  /** The Tile a delete deletes, and the view to show once it is gone; the Root has none. */
  deletion?: { id: string; then: CanvasView }
  onViewChange: (view: CanvasView) => void
}

function CenteredTile({
  title,
  description,
  onEdit,
  onMove,
  deletion,
  onViewChange,
}: CenteredTileProps) {
  const remove = useDeleteTile()
  return (
    <Card
      title={title}
      description={description === '' ? undefined : description}
      footer={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onEdit}>
            {m.system_edit()}
          </Button>
          {onMove && (
            <Button variant="outline" size="sm" onClick={onMove}>
              {m.system_move()}
            </Button>
          )}
          {deletion && (
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
              onConfirm={() => {
                remove.mutate(
                  { id: deletion.id },
                  {
                    onSuccess: () => {
                      onViewChange(deletion.then)
                    },
                  },
                )
              }}
            />
          )}
        </div>
      }
    />
  )
}

interface ChangeDrawerProps {
  system: System
  tree: TileNode
  change: Change
  onDone: () => void
}

/** The drawer of the change under way, when it is a form: a new Tile's, or a Tile's. */
function ChangeDrawer({ system, tree, change, onDone }: ChangeDrawerProps) {
  const form = drawerOf(system, tree, change)
  return (
    <Drawer
      open={form !== undefined}
      onOpenChange={(open) => {
        if (!open) onDone()
      }}
      title={form?.title}
      description={form?.description}
    >
      {form?.kind === 'add' && (
        <NewTileForm key={form.key} parent={form.parent} slot={form.slot} onSaved={onDone} />
      )}
      {form?.kind === 'edit' && <EditTileForm key={form.key} tile={form.tile} onSaved={onDone} />}
    </Drawer>
  )
}

/** What the drawer shows for a change; `undefined` when the change is no form, or names no Tile. */
function drawerOf(system: System, tree: TileNode, change: Change) {
  if (change.kind === 'add') {
    const parent = findTile(tree, change.parent)
    if (parent === undefined) return undefined
    return {
      kind: 'add',
      key: `${change.parent}:${String(change.slot)}`,
      title: m.system_add_title(),
      description:
        change.slot > 0
          ? m.system_add_under({ title: parent.title })
          : m.system_add_in_context({ title: parent.title }),
      parent: change.parent,
      slot: change.slot,
    } as const
  }
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

interface NewTileFormProps {
  parent: string
  slot: Extract<Change, { kind: 'add' }>['slot']
  onSaved: () => void
}

function NewTileForm({ parent, slot, onSaved }: NewTileFormProps) {
  const submit = useCreateTileSubmit({ parent, slot }, onSaved)
  return (
    <TileForm
      defaults={{ title: '', preview: '', body: '' }}
      submit={submit}
      label={m.system_add()}
    />
  )
}

function EditTileForm({ tile, onSaved }: { tile: System; onSaved: () => void }) {
  const submit = useEditTileSubmit(tile, onSaved)
  const { title, preview, body } = tile
  return <TileForm defaults={{ title, preview, body }} submit={submit} label={m.system_save()} />
}

interface TileFormProps {
  defaults: TileContent
  submit: ReturnType<typeof useEditTileSubmit>
  label: string
}

/** A Tile's Title, Preview and Body. What each must be is Mapping's to say, on the field at fault. */
function TileForm({ defaults, submit, label }: TileFormProps) {
  const form = useAppForm({ defaultValues: defaults, validators: { onSubmitAsync: submit } })
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
