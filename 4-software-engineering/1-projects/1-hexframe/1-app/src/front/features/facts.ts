// The facts the client bus carries, each declared once with its schema, so a feature that publishes
// one and a feature that reacts to it both reach it without importing each other.
import { Schema } from 'effect'

import { Gesture, TileId } from '#/front/ui/hex/view/view'

/**
 * The user went somewhere on the canvas: the gesture they made, as the canvas names it, and the Tile
 * they made it on. The Conversation records it as a navigation, consecutive ones merged into one.
 */
export class Navigated extends Schema.TaggedClass<Navigated>()('Navigated', {
  gesture: Gesture,
  tile: TileId,
}) {}
