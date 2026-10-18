// The tile widget in the chat, at the conversation's foot: the change under way when it is a form, a
// new Tile's in the slot clicked, a Tile's edit or an import, or who may see a Tile, its share
// widget (`share/`), as the URL holds it; once a form is
// sent, the receipt it leaves; or an export a Tile's menu started, working, then its receipt, or failed.
// One at a time, the latest. A write ends its form as it is sent, its receipt in the form's place at
// once, and a refusal puts the form back (`useRefusalState`), the user's words with it. The Root's
// edit is a widget too, with no place to draw, a pencil in its hex.
import { useMemo } from 'react'

import {
  isEmptySystem,
  isLeafSlot,
  tileAt,
  type Slot,
  type System,
  type SystemTile,
} from '#/domains/mapping/entities'
import { type ImportPlace, useDeleteTile, useSystem } from '#/front/client/mapping/queries'
import { findTile, type TileNode } from '#/front/ui/canvas/view/tiles'
import { TileExport } from '#/front/ui/chat/widgets/tile/Transfer'

import { Import } from '../import/Import'
import {
  afterDelete,
  changeOf,
  keyOf,
  withChange,
  type Change,
  type SearchChange,
  type SystemSearch,
} from '../search/search'
import { type Reopened, useRefusalState } from '../state/useRefusalState'
import { canvasTree, tileIn } from '../tree'
import { EditTileWidget, NameRootWidget, NewTileWidget } from './forms'
import { freeFor, slotOf, tilesBelow, whereIn } from './place'
import { ShareWidgets } from './share/ShareWidgets'
import type { Exporting, Receipt, TileWidgetsState } from './state/useTileWidgetsState'

interface TileWidgetsProps {
  search: SystemSearch
  onSearchChange: (change: SearchChange) => void
  /** Centers the canvas on a Tile a widget names. */
  onCenter: (tile: string) => void
  /** What follows a form, and the export under way: the page's, which the canvas's menus share. */
  widgets: TileWidgetsState
  /** A form a refusal put back: on a phone, the chat comes to the front to show it. */
  onFormBack: () => void
}

export function TileWidgets({
  search,
  onSearchChange,
  onCenter,
  widgets,
  onFormBack,
}: TileWidgetsProps) {
  // Read without throwing, as the chat does: a failed read shows on the canvas.
  const { data } = useSystem({ throwing: false })
  // A refused write's receipt goes, and a form put back comes to the front.
  const reopened = useRefusalState(search, onSearchChange, ({ tile, formBack }) => {
    if (tile !== undefined) widgets.actions.refused(tile)
    if (formBack) onFormBack()
  })
  const remove = useDeleteTile()
  const root = data?.root
  const tree = useMemo(() => (root === undefined ? undefined : canvasTree(root)), [root])
  if (data === undefined || root === undefined || tree === undefined) return null
  const change = changeOf(search)
  const end = () => {
    onSearchChange((current) => withChange(current, { kind: 'none' }))
  }
  const page: WidgetContext = {
    system: data.system,
    root,
    tree,
    reopened,
    onCenter,
    naming: { name: widgets.state.naming, onNameChange: widgets.actions.name },
    onSent: (receipt) => {
      widgets.actions.sent(receipt)
      end()
    },
    onCancel: () => {
      widgets.actions.clear()
      end()
    },
    begin: (next) => {
      onSearchChange(withChange(search, next))
    },
    remove: (tile, node, parent) => {
      remove.mutate({ id: tile.id, version: tile.version })
      onSearchChange(afterDelete(tree, parent, node))
    },
  }
  // A new account is asked its pseudo until it gives one.
  if (root.title === '' && change.kind === 'none' && widgets.state.shown === undefined) {
    return nameOf(page)
  }
  return widgetOf(change, widgets, page)
}

/** A new account's first question: its pseudo, which names its Root; or a vault, into an empty one. */
function nameOf(page: WidgetContext) {
  const { id, version, title, preview, body } = page.root
  return (
    <NameRootWidget
      key="name"
      {...formOf(page, 'name', undefined)}
      {...page.naming}
      root={{ id, version, title, preview, body }}
      onImport={
        isEmptySystem(page.root)
          ? () => {
              page.begin({ kind: 'import', place: { _tag: 'Root' } })
            }
          : undefined
      }
    />
  )
}

interface WidgetContext {
  system: System
  root: SystemTile
  tree: TileNode
  reopened: Reopened | undefined
  onCenter: (id: string) => void
  /** The pseudo typed so far for the untitled Root, which the canvas shows as it is typed. */
  naming: { name: string; onNameChange: (name: string) => void }
  onSent: (receipt: Omit<Receipt, 'kind'>) => void
  onCancel: () => void
  /** Another change under way in its place: an import in the slot a new Tile was opened on. */
  begin: (change: Change) => void
  /** Deletes a Tile, and everything below it, centering the Tile it stood under at once. */
  remove: (tile: { id: string; version: number }, node: TileNode, parent: string) => void
}

/** The widget of the change under way, when it is one; else what followed the last. */
function widgetOf(change: Change, widgets: TileWidgetsState, page: WidgetContext) {
  switch (change.kind) {
    case 'add':
      return newTileOf(change, widgets.state.shown, page)
    case 'edit':
      return editOf(change, widgets.state.shown, page)
    case 'import':
      return importOf(change.place, page)
    case 'share':
      return shareOf(change.id, page)
    case 'none':
    case 'move':
      return shownOf(widgets, page)
  }
}

/** Who may see a Tile of the Account's own System; none for a Tile it no longer holds. */
function shareOf(id: string, page: WidgetContext) {
  const shared = tileAt(page.system, id)
  if (shared === undefined) return null
  return (
    <ShareWidgets
      key={`share:${id}`}
      system={page.system}
      tile={{ id, title: shared.title }}
      onClose={page.onCancel}
    />
  )
}

/** The receipt a form left, or the export under way, once no form is open. */
function shownOf(widgets: TileWidgetsState, page: WidgetContext) {
  const { shown } = widgets.state
  if (shown === undefined) return null
  return shown.kind === 'export' ? exportOf(shown, widgets, page) : receiptOf(shown, page)
}

/** A form's receipt, as the widget it ends, by the same key, so it keeps the form's focus. */
function receiptOf(receipt: Receipt, page: WidgetContext) {
  const { key, session, where } = receipt
  const form = formOf(page, key, receipt)
  if (session.kind === 'name') {
    return <NameRootWidget key={key} {...form} {...page.naming} root={session.root} />
  }
  return session.kind === 'add' && where !== undefined ? (
    <NewTileWidget
      key={key}
      {...form}
      parent={{ id: session.parent, title: where.parent }}
      slot={slotOf(where.kind, where.place)}
    />
  ) : session.kind === 'edit' ? (
    <EditTileWidget key={key} {...form} tile={session.opened} where={where} />
  ) : null
}

/** The receipt of this form, sent while the URL still holds it, unless a refusal put it back. */
const receiptFor = (key: string, shown: Receipt | Exporting | undefined, page: WidgetContext) =>
  shown?.kind === 'receipt' && shown.key === key && page.reopened === undefined ? shown : undefined

/**
 * A new Tile's widget, keyed by the Tile it goes under, so picking another place or kind keeps what
 * the user wrote; none when that Tile is gone.
 */
function newTileOf(
  change: Extract<Change, { kind: 'add' }>,
  shown: Receipt | Exporting | undefined,
  page: WidgetContext,
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
      onImport={() => {
        page.begin({
          kind: 'import',
          place: { _tag: 'Slot', parent: change.parent, slot: importSlotOf(page.system, change) },
        })
      }}
    />
  )
}

/**
 * Where an import goes in the place a new Tile was opened on: a new Tile is a Leaf, but a folder
 * takes a Branch's slot, in the same Direction where it is free; a Leaf's slot otherwise, one file.
 */
function importSlotOf(system: System, { parent, slot }: { parent: string; slot: Slot }): Slot {
  if (!isLeafSlot(slot)) return slot
  return freeFor(system, parent, 'branch').includes(slot.leaf) ? slot.leaf : slot
}

/**
 * A Tile's edit, keyed by the Tile and the refusal that put it back, so a form a refusal reopens
 * opens on the Tile as it now stands; none when the Tile is gone and nothing was sent.
 */
function editOf(
  change: Extract<Change, { kind: 'edit' }>,
  shown: Receipt | Exporting | undefined,
  page: WidgetContext,
) {
  const key = `edit:${change.id}:${String(page.reopened?.turn ?? '')}`
  const receipt = receiptFor(key, shown, page)
  if (receipt !== undefined) return receiptOf(receipt, page)
  if (change.id === page.root.id) return rootOf(key, page)
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

/** The Root's edit: the user's own Tile, which stands under nothing and goes with nothing. */
function rootOf(key: string, page: WidgetContext) {
  const { id, version, title, preview, body } = page.root
  return (
    <EditTileWidget
      key={key}
      {...formOf(page, key, undefined)}
      tile={{ id, version, title, preview, body }}
      where={undefined}
    />
  )
}

/** The Tile an edit is open on, below the Root, where it stands; none once it is gone. */
function editingOf(id: string, page: WidgetContext) {
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
const formOf = (page: WidgetContext, key: string, receipt: Receipt | undefined) => ({
  formKey: key,
  refilled: page.reopened,
  receipt,
  system: page.system,
  onSent: page.onSent,
  onCancel: page.onCancel,
  onCenter: page.onCenter,
})

/** An import's widget, where it lands lit; none when the Tile it goes under is gone. */
function importOf(place: ImportPlace, page: WidgetContext) {
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

/** An export a Tile's menu started: working, then its receipt naming the zip, or failed with a retry. */
function exportOf(exporting: Exporting, widgets: TileWidgetsState, page: WidgetContext) {
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
      onDismiss={widgets.actions.clear}
    />
  )
}
