// Where an import lands, as its server function takes it, apart from the server functions themselves
// so the client reads a pending import's place by the same schema (`front/client/mapping/overlay/`)
// without loading them. Pure.
import { Schema } from 'effect'

import { Slot, TileId } from '#/domains/mapping/entities'

/**
 * Where an import lands: a free slot under a Tile of the System, a Branch's, a Leaf's or a Context
 * slot, or the Root of an empty System.
 */
export const ImportPlace = Schema.Union([
  Schema.Struct({ _tag: Schema.tag('Slot'), parent: TileId, slot: Slot }),
  Schema.Struct({ _tag: Schema.tag('Root') }),
])
export type ImportPlace = typeof ImportPlace.Type
