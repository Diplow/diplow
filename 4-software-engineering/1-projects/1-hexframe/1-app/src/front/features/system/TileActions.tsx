// What the user can do to the centered Tile, from its card at the canvas's foot: edit it, move it,
// export it, delete it, grow a Leaf into a Branch or shrink a bare Branch into a Leaf, and, on an empty
// System's Root, import a vault; a Leaf that isn't Markdown shows its Body as code. An edit and an
// import open the tile widget in the chat (`widget/TileWidgets.tsx`), the move is under way on the
// canvas, both the URL's; an export shows in the chat too, working, then its receipt. A delete ends
// the moment it is sent, centering the Tile it stood under; its refusal shows in a toast.
import {
  isEmptySystem,
  type System as FlatSystem,
  type SystemTile,
} from '#/domains/mapping/entities'
import { useDeleteTile } from '#/front/client/mapping/queries'
import { m } from '#/paraglide/messages'
import type { TileNode } from '#/front/ui/canvas/view/tiles'
import { showView } from '#/front/ui/canvas/view/view'
import { Button } from '#/front/ui/atoms/controls/button'
import { ConfirmDialog } from '#/front/ui/layouts/ConfirmDialog'
import { CodeBlock } from '#/front/ui/seams/Markdown'
import { Card } from '#/front/ui/canvas/layouts/Card'

import {
  afterDelete,
  viewOf,
  withChange,
  type Change,
  type SearchChange,
  type SystemSearch,
} from './search/search'
import { type KindChange, useCenteredTileState } from './state/useCenteredTileState'
import { tileIn } from './tree'
import type { Exported } from './widget/state/useTileWidgetsState'
import { tilesBelow } from './widget/place'

interface TileActionsProps {
  /** The System's Root, with everything below it. */
  system: SystemTile
  /** The System as the page shows it, flat: how many Tiles go along with an export. */
  flat: FlatSystem
  /** The System's Tiles as the canvas draws them (`canvasTree`). */
  tree: TileNode
  search: SystemSearch
  onSearchChange: (change: SearchChange) => void
  /** Exports a Tile, which the chat shows; waits while one is on its way. */
  exporting: { start: (exported: Exported) => void; pending: boolean }
}

export function TileActions({
  system,
  flat,
  tree,
  search,
  onSearchChange,
  exporting,
}: TileActionsProps) {
  const view = viewOf(search)
  const center = showView(tree, view).center
  // A broken Reference, centered, stands for no Tile: there is nothing to act on.
  const found = tileIn(system, center.id)
  const parent = found?.parent
  const { code, kindChange } = useCenteredTileState(system, center.id)
  const remove = useDeleteTile()
  const begin = (change: Change) => {
    onSearchChange(withChange(search, change))
  }
  if (found === undefined) return null
  return (
    <CenteredTile
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
      exporting={exporting.pending}
      onExport={() => {
        exporting.start({
          tile: { id: found.tile.id, title: center.title },
          below: tilesBelow(flat, found.tile.id),
        })
      }}
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
          remove.mutate({ id: found.tile.id, version: found.tile.version })
          onSearchChange(afterDelete(tree, parent.id, center))
        },
      })}
      // An empty System invites the user to start: its Root takes a whole vault.
      {...(isEmptySystem(system) && {
        onImport: () => {
          begin({ kind: 'import', place: { _tag: 'Root' } })
        },
      })}
    />
  )
}

interface CenteredTileProps {
  title: string
  description: string
  /** The Body shown as code under the title: a Leaf's that isn't Markdown. */
  code?: string | undefined
  /** Grows a Leaf into a Branch, or shrinks a Branch with nothing below it into a Leaf. */
  kindChange?: KindChange | undefined
  /** An export on its way: Export waits. */
  exporting: boolean
  onExport: () => void
  onEdit: () => void
  onMove?: () => void
  /** Deletes the Tile, once the user confirms; the Root, which is never deleted, has none. */
  onDelete?: () => void
  /** Opens a vault's import as the Root: an empty System's only. */
  onImport?: () => void
}

function CenteredTile({
  title,
  description,
  code,
  kindChange,
  exporting,
  onExport,
  onEdit,
  onMove,
  onDelete,
  onImport,
}: CenteredTileProps) {
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
          <Button variant="outline" size="sm" disabled={exporting} onClick={onExport}>
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
