// The facts the client bus carries, each declared once with its schema, so a feature that publishes
// one and a feature that reacts to it both reach it without importing each other.
import { Schema } from 'effect'

import { Direction } from '#/domains/mapping/entities'
import { TileId, ViewAction } from '#/front/ui/canvas/view/view'

/**
 * The user went somewhere on the canvas: the gesture they made, as the canvas names it, and the Tile
 * they made it on. The Conversation records it as a navigation, consecutive ones merged into one.
 */
export class Navigated extends Schema.TaggedClass<Navigated>()('Navigated', ViewAction.fields) {}

/**
 * The user asked the agent through the chat from a menu on the canvas: about a Tile, or, with a
 * place, for a new Tile under it there. The composer names the Tile first, so the next Turn works in
 * it, what was written kept.
 */
export class AskedAboutTile extends Schema.TaggedClass<AskedAboutTile>()('AskedAboutTile', {
  tile: TileId,
  place: Schema.optionalKey(Direction),
}) {}
