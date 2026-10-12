// What the chat shows of a tile once its widget is done with it: the receipt a write sent leaves, or
// an export, working, then its receipt naming the zip, or failed. The form under way is the URL's;
// this is what follows it, held by the page so the card on the canvas and the chat share it. One at
// a time: a form opening ends it, a write sent leaves its receipt in its place, an export takes it,
// and a form closed unsent leaves nothing.
import { useState } from 'react'

import type { SystemTile } from '#/domains/mapping/entities'
import { type TileContent, useExportTile } from '#/front/client/mapping/queries'
import type { TilePlace } from '#/front/ui/chat/widgets/tile/parts'

/** A Tile as its edit opened on it: its words, by its id, at the Version the page drew. */
export type Opened = TileContent & Pick<SystemTile, 'id' | 'version'>

/** The form a receipt is the end of: a new Tile's, under its parent, or a Tile's edit. */
type Session =
  | { readonly kind: 'add'; readonly parent: string }
  | { readonly kind: 'edit'; readonly opened: Opened }

/** What a write sent leaves: what was done, to which Tile, where, and when. */
export interface Receipt {
  /** The key of the form it ends, which it keeps, so the one widget goes from form to receipt. */
  readonly key: string
  readonly session: Session
  readonly did: 'created' | 'edited' | 'deleted'
  /** The Tile written, by its id, which the receipt centers the canvas on while it stands. */
  readonly tile: { readonly id: string; readonly title: string }
  readonly where: TilePlace
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

type Last =
  | { readonly kind: 'receipt'; readonly receipt: Receipt }
  | (Exported & { readonly kind: 'export'; readonly at: Date })

/** What follows a tile's widget in the chat, and the export the card starts. */
export function useTileWidgetsState() {
  const exporting = useExportTile()
  const [last, setLast] = useState<Last>()
  const { reset, mutate } = exporting
  const shown: Receipt | Exporting | undefined =
    last?.kind === 'export'
      ? {
          ...last,
          phase: exporting.isError ? 'failed' : exporting.isSuccess ? 'done' : 'working',
          file: exporting.data?.name,
        }
      : last?.receipt
  return {
    state: {
      shown,
      /** An export on its way: the card's Export waits. */
      exporting: exporting.isPending,
    },
    actions: {
      /** A form opened: what followed the last one goes. */
      opened: () => {
        setLast(undefined)
        reset()
      },
      /** A form's write sent: its receipt takes the form's place. */
      sent: (receipt: Receipt) => {
        setLast({ kind: 'receipt', receipt })
        reset()
      },
      /** A form closed unsent, or an export let go: nothing follows. */
      closed: () => {
        setLast(undefined)
        reset()
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
