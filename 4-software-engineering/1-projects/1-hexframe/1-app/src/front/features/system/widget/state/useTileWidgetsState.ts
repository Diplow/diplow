// What the chat shows of a tile once its widget is done with it: the receipt a write sent leaves, or
// an export, working, then its receipt naming the zip, or failed. The form under way is the URL's;
// this is what follows it, held by the page so the canvas's menus and the chat share it. One at
// a time: a form opening ends it, a write sent leaves its receipt in its place, an export takes it,
// and a form closed unsent leaves nothing. And the pseudo a new account is typing, which the canvas
// shows on its untitled Root as it is typed, until a form opens.
import { useState } from 'react'

import type { SystemTile } from '#/domains/mapping/entities'
import { type TileContent, useExportTile } from '#/front/client/mapping/queries'
import type { TilePlace } from '#/front/ui/chat/widgets/tile/parts'

/** A Tile as its edit opened on it: its words, by its id, at the Version the page drew. */
export type Opened = TileContent & Pick<SystemTile, 'id' | 'version'>

/**
 * The form a receipt is the end of: a new Tile's, under its parent, a Tile's edit, or the Root named
 * with the pseudo a new account goes by.
 */
type Session =
  | { readonly kind: 'add'; readonly parent: string }
  | { readonly kind: 'edit'; readonly opened: Opened }
  | { readonly kind: 'name'; readonly root: Opened }

/** What a write sent leaves: what was done, to which Tile, where, and when. */
export interface Receipt {
  readonly kind: 'receipt'
  /** The key of the form it ends, which it keeps, so the one widget goes from form to receipt. */
  readonly key: string
  readonly session: Session
  readonly did: 'created' | 'edited' | 'deleted' | 'named'
  /** The Tile written, by its id, which the receipt centers the canvas on while it stands. */
  readonly tile: { readonly id: string; readonly title: string }
  /** Where it stands; none for the Root, which stands under nothing. */
  readonly where: TilePlace | undefined
  readonly at: Date
}

/** A Tile exported, and how many go along with it. */
export interface Exported {
  readonly tile: { readonly id: string; readonly title: string }
  readonly below: number
}

/** An export as the chat shows it: working, saved under its file's name, or failed. */
export interface Exporting extends Exported {
  readonly kind: 'export'
  readonly phase: 'working' | 'done' | 'failed'
  readonly file: string | undefined
  readonly at: Date
}

type Last = Receipt | (Exported & { readonly kind: 'export'; readonly at: Date })

/** What follows a tile's widget in the chat, and the export a Tile's menu starts. */
export function useTileWidgetsState() {
  const exporting = useExportTile()
  const [last, setLast] = useState<Last>()
  const [naming, setNaming] = useState('')
  const { mutate, isPending } = exporting
  // An export on its way runs to its end, the menu's Export waiting, even once the chat lets it go.
  const settle = () => {
    if (!isPending) exporting.reset()
  }
  const shown: Receipt | Exporting | undefined =
    last?.kind === 'export'
      ? {
          ...last,
          phase: exporting.isError ? 'failed' : exporting.isSuccess ? 'done' : 'working',
          file: exporting.data?.name,
        }
      : last
  return {
    state: {
      shown,
      /** An export on its way: the menu's Export waits. */
      exporting: isPending,
      /** The pseudo being typed for the untitled Root, which its hex shows; empty while none is. */
      naming,
    },
    actions: {
      /** A form opened, or one closed unsent, or an export let go: nothing follows. */
      clear: () => {
        setLast(undefined)
        setNaming('')
        settle()
      },
      /** The pseudo typed so far for the untitled Root. */
      name: setNaming,
      /** A form's write sent: its receipt takes the form's place. */
      sent: (receipt: Omit<Receipt, 'kind'>) => {
        setLast({ kind: 'receipt', ...receipt })
        settle()
      },
      /** A write to this Tile refused: a receipt saying it was done goes. */
      refused: (tile: string) => {
        setLast((shown) =>
          shown?.kind === 'receipt' && shown.tile.id === tile ? undefined : shown,
        )
      },
      /** Exports a Tile, everything below it with it; the browser saves the zip. */
      export: (exported: Exported) => {
        setLast({ kind: 'export', ...exported, at: new Date() })
        mutate({ id: exported.tile.id })
      },
    },
  }
}

export type TileWidgetsState = ReturnType<typeof useTileWidgetsState>
