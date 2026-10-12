// What home carries in its URL of the Account's Keys: whether the key widget is open, so a link, an
// old one to the Keys page included, opens it. The step it is on is the page's, the secret above all.
// Pure.
import { Schema } from 'effect'

import { orDefault, readSearch } from '#/front/ui/canvas/view/view'

const KeysSearch = Schema.Struct({
  /** The key widget open; closed when absent. */
  keys: Schema.optionalKey(orDefault(Schema.Literal(true))),
})

export type KeysSearch = typeof KeysSearch.Type

/** Reads the URL's search param, which falls back on the widget closed. */
export const readKeysSearch = readSearch(KeysSearch)

/** The search param with the key widget open, or closed. */
export const withKeys = (open: boolean): KeysSearch => ({ keys: open ? true : undefined })
