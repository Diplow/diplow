// An import, in the chat, as the tile widget draws one (ui's `TileImport`): its pickers and its drop
// zone while it waits for files, where the Tile would go lit; then what it came to, the Tiles created
// and every file left behind, or every fault and nothing written. What it holds and does is its state
// hook's (./state/useImportState.ts); this only hands it over.
import type { ImportPlace } from '#/front/client/mapping/queries'
import type { TilePlace } from '#/front/ui/chat/widgets/tile/parts'
import { TileImport } from '#/front/ui/chat/widgets/tile/Transfer'

import { useImportState } from './state/useImportState'

interface ImportProps {
  place: ImportPlace
  /** Where it lands, as the widget draws it: a free place under a Tile, or the Root. */
  into: TilePlace | 'root'
  /** The user read what it came to, or let it go before giving any file. */
  onDone: () => void
}

export function Import({ place, into, onDone }: ImportProps) {
  const { state, actions } = useImportState(place)
  switch (state.phase) {
    case 'landed':
      return (
        <TileImport
          into={into}
          phase="landed"
          tiles={state.tiles}
          leftOut={state.leftOut}
          onDone={onDone}
        />
      )
    case 'refused':
      return (
        <TileImport
          into={into}
          phase="refused"
          faults={state.faults}
          leftOut={state.leftOut}
          onAgain={actions.again}
          onDone={onDone}
        />
      )
    case 'choosing':
    case 'importing':
      return (
        <TileImport
          into={into}
          phase={state.phase}
          fileOnly={state.fileOnly}
          onDrop={actions.drop}
          onPickFolder={actions.pickFolder}
          onPickFile={actions.pickFile}
          onDone={onDone}
        />
      )
  }
}
