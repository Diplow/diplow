// The tile widget in the chat, at the conversation's foot: the change under way when it is a form, a
// new Tile's in the slot clicked, a Tile's edit or an import, as the URL holds it; once a form is
// sent, the receipt it leaves; or an export the card started, working, then its receipt, or failed.
// One at a time, the latest. A write ends its form as it is sent, its receipt in the form's place at
// once, and a refusal puts the form back (`useRefusalState`), the user's words with it. The Root's
// edit opens the drawer: the widget draws no place for it.
import { useMemo } from 'react'

import { tileAt, type System, type SystemTile } from '#/domains/mapping/entities'
import { type ImportPlace, useDeleteTile, useSystem } from '#/front/client/mapping/queries'
import { findTile, type TileNode } from '#/front/ui/canvas/view/tiles'
import { centerOn } from '#/front/ui/canvas/view/view'
import { TileExport } from '#/front/ui/chat/widgets/tile/Transfer'

import { Import } from '../import/Import'
import {
  changeOf,
  keyOf,
  withChange,
  withoutTile,
  withView,
  type Change,
  type SearchChange,
  type SystemSearch,
} from '../search/search'
import { type Reopened, useRefusalState } from '../state/useRefusalState'
import { canvasTree, tileIn } from '../tree'
import { EditTileWidget, NewTileWidget, RootDrawer } from './forms'
import { refusalOf, slotOf, tilesBelow, whereIn } from './place'
import type { Refilled } from './state/useTileWordsState'
import type { Exporting, Receipt, TileWidgetsState } from './state/useTileWidgetsState'

interface TileWidgetsProps {
  search: SystemSearch
  onSearchChange: (change: SearchChange) => void
  /** Centers the canvas on a Tile a widget names. */
  onCenter: (tile: string) => void
  /** What follows a form, and the export under way: the page's, which the card shares. */
  widgets: TileWidgetsState
}

export function TileWidgets({ search, onSearchChange, onCenter, widgets }: TileWidgetsProps) {
  // Read without throwing, as the chat does: a failed read shows on the canvas.
  const { data } = useSystem({ throwing: false })
  const reopened = useRefusalState(search, onSearchChange)
  const remove = useDeleteTile()
  const root = data?.root
  const tree = useMemo(() => (root === undefined ? undefined : canvasTree(root)), [root])
  if (data === undefined || root === undefined || tree === undefined) return null
  const change = changeOf(search)
  const end = () => {
    onSearchChange((current) => withChange(current, { kind: 'none' }))
  }
  const page: Page = {
    system: data.system,
    root,
    tree,
    reopened,
    onCenter,
    onSent: (receipt) => {
      widgets.actions.sent(receipt)
      end()
    },
    onCancel: () => {
      widgets.actions.closed()
      end()
    },
    begin: (next) => {
      onSearchChange(withChange(search, next))
    },
    remove: (tile, node, parent) => {
      remove.mutate({ id: tile.id, version: tile.version })
      onSearchChange((current) => withoutTile(withView(current, centerOn(tree, parent)), node))
    },
  }
  const editsRoot = change.kind === 'edit' && change.id === root.id
  return (
    <>
      {editsRoot ? shownOf(widgets, page) : widgetOf(change, widgets, page)}
      <RootDrawer
        root={editsRoot ? root : undefined}
        refilled={reopened}
        onSent={end}
        onClose={end}
      />
    </>
  )
}

/** What the widgets of a page share: the System, the refusal put back, and the ways on. */
interface Page {
  system: System
  root: SystemTile
  tree: TileNode
  reopened: Reopened | undefined
  onCenter: (id: string) => void
  onSent: (receipt: Receipt) => void
  onCancel: () => void
  /** Another change under way in its place: an import in the slot a new Tile was opened on. */
  begin: (change: Change) => void
  /** Deletes a Tile, and everything below it, centering the Tile it stood under at once. */
  remove: (tile: { id: string; version: number }, node: TileNode, parent: string) => void
}

/** The widget of the change under way, when it is one; else what followed the last. */
function widgetOf(change: Change, widgets: TileWidgetsState, page: Page) {
  switch (change.kind) {
    case 'add':
      return newTileOf(change, widgets.state.shown, page)
    case 'edit':
      return editOf(change, widgets.state.shown, page)
    case 'import':
      return importOf(change.place, page)
    case 'none':
    case 'move':
      return shownOf(widgets, page)
  }
}

/** The receipt a form left, or the export under way, once no form is open. */
function shownOf(widgets: TileWidgetsState, page: Page) {
  const { shown } = widgets.state
  if (shown === undefined) return null
  return 'kind' in shown ? exportOf(shown, widgets, page) : receiptOf(shown, page)
}

/** A form's receipt, as the widget it ends, by the same key, so it keeps the form's focus. */
function receiptOf(receipt: Receipt, page: Page) {
  const { key, session, where } = receipt
  const form = formOf(page, key, receipt)
  return session.kind === 'add' ? (
    <NewTileWidget
      key={key}
      {...form}
      parent={{ id: session.parent, title: where.parent }}
      slot={slotOf(where.kind, where.place)}
      onSlotChange={() => undefined}
      onImport={() => undefined}
    />
  ) : (
    <EditTileWidget key={key} {...form} tile={session.opened} where={where} />
  )
}

/** The receipt of this form, sent while the URL still holds it, unless a refusal put it back. */
const receiptFor = (key: string, shown: Receipt | Exporting | undefined, page: Page) =>
  shown !== undefined && !('kind' in shown) && shown.key === key && page.reopened === undefined
    ? shown
    : undefined

/** What a refusal put back into the widget, the change under way's: the user's words, its refusal. */
const refilledOf = (reopened: Reopened | undefined): Refilled | undefined =>
  reopened === undefined
    ? undefined
    : { turn: reopened.turn, words: reopened.content, refused: refusalOf(reopened.shown) }

/**
 * A new Tile's widget, keyed by the Tile it goes under, so picking another place or kind keeps what
 * the user wrote; none when that Tile is gone.
 */
function newTileOf(
  change: Extract<Change, { kind: 'add' }>,
  shown: Receipt | Exporting | undefined,
  page: Page,
) {
  const key = `add:${change.parent}`
  const receipt = receiptFor(key, shown, page)
  if (receipt !== undefined) return receiptOf(receipt, page)
  const parent = findTile(page.tree, change.parent)
  if (parent === undefined) return null
  return (
    <NewTileWidget
      key={key}
      {...formOf(page, key, undefined)}
      parent={{ id: change.parent, title: parent.title }}
      slot={change.slot}
      onSlotChange={(slot) => {
        page.begin({ ...change, slot })
      }}
      onImport={() => {
        page.begin({
          kind: 'import',
          place: { _tag: 'Slot', parent: change.parent, slot: change.slot },
        })
      }}
    />
  )
}

/**
 * A Tile's edit, keyed by the Tile and the refusal that put it back, so a form a refusal reopens
 * opens on the Tile as it now stands; none when the Tile is gone and nothing was sent.
 */
function editOf(
  change: Extract<Change, { kind: 'edit' }>,
  shown: Receipt | Exporting | undefined,
  page: Page,
) {
  const key = `edit:${change.id}:${String(page.reopened?.turn ?? '')}`
  const receipt = receiptFor(key, shown, page)
  if (receipt !== undefined) return receiptOf(receipt, page)
  const editing = editingOf(change.id, page)
  if (editing === undefined) return null
  const { tile, node, parent, where } = editing
  return (
    <EditTileWidget
      key={key}
      {...formOf(page, key, undefined)}
      tile={tile}
      where={where}
      deleting={{
        below: tilesBelow(page.system, tile.id),
        confirm: () => {
          page.remove(tile, node, parent)
        },
      }}
    />
  )
}

/** The Tile an edit is open on, below the Root, where it stands; none once it is gone. */
function editingOf(id: string, page: Page) {
  const located = tileIn(page.root, id)
  const node = findTile(page.tree, id)
  const placed = tileAt(page.system, id)
  if (located?.parent === undefined || node === undefined || placed === undefined) return undefined
  if (!('slot' in placed)) return undefined
  const { parent } = located
  const title = findTile(page.tree, parent.id)?.title ?? parent.title
  return {
    tile: located.tile,
    node,
    parent: parent.id,
    where: whereIn(page.system, { id: parent.id, title }, placed.slot),
  }
}

/** What a form takes from the page. */
const formOf = (page: Page, key: string, receipt: Receipt | undefined) => ({
  formKey: key,
  refilled: refilledOf(page.reopened),
  receipt,
  system: page.system,
  onSent: page.onSent,
  onCancel: page.onCancel,
  onCenter: page.onCenter,
})

/** An import's widget, where it lands lit; none when the Tile it goes under is gone. */
function importOf(place: ImportPlace, page: Page) {
  if (place._tag === 'Root') {
    return <Import key="root" place={place} into="root" onDone={page.onCancel} />
  }
  const parent = findTile(page.tree, place.parent)
  if (parent === undefined) return null
  return (
    <Import
      key={keyOf({ kind: 'import', place })}
      place={place}
      into={whereIn(page.system, parent, place.slot)}
      onDone={page.onCancel}
    />
  )
}

/** An export the card started: working, then its receipt naming the zip, or failed with a retry. */
function exportOf(exporting: Exporting, widgets: TileWidgetsState, page: Page) {
  const { tile, below, phase, file, at } = exporting
  const stands = tileAt(page.system, tile.id) !== undefined
  return (
    <TileExport
      tile={{
        title: tile.title,
        ...(stands && {
          onCenter: () => {
            page.onCenter(tile.id)
          },
        }),
      }}
      below={below}
      phase={phase}
      {...(file !== undefined && { file })}
      at={at}
      onRetry={() => {
        widgets.actions.export({ tile, below })
      }}
      onDismiss={widgets.actions.closed}
    />
  )
}
