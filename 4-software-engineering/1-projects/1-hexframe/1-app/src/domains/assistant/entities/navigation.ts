// Where the user went on the canvas, as the Conversation keeps it: consecutive navigations merged into
// one Entry, the gestures in the order they came, the latest kept, and how many were merged. The
// canvas names the gestures (`front/ui/hex/view/view.ts`); the Conversation keeps each word as it came,
// knowing none of them, as it knows no Tile but by its id. The browser merges as the user goes, and
// sends the merged Entry once something else enters the timeline. Pure.
import { Schema } from 'effect'

/** A gesture, as the canvas names it (`center`, `show-context`): lowercase words joined by `-`. */
const Gesture = Schema.String.check(
  Schema.isPattern(/^[a-z]+(-[a-z]+)*$/),
  Schema.isMaxLength(32),
)

/** A Tile, by its id as the canvas names it. */
const TileRef = Schema.String.check(Schema.isNonEmpty(), Schema.isMaxLength(100))

/** One gesture, and the Tile it was made on. */
export const Step = Schema.Struct({ gesture: Gesture, tile: TileRef })

export type Step = typeof Step.Type

/** How many of a merged navigation's latest gestures it keeps: where the user ended up matters most. */
export const stepsKept = 12

/** The most gestures one navigation counts, past which it stops counting. */
const mostGestures = 1_000_000

/** A navigation counts every gesture it kept, and maybe more. */
const countsItsSteps = Schema.makeFilter(
  ({ steps, gestures }: { readonly steps: ReadonlyArray<unknown>; readonly gestures: number }) =>
    gestures >= steps.length,
)

/**
 * Consecutive navigations merged into one Entry: the latest `stepsKept` gestures, oldest first, each
 * with its Tile, and how many gestures were merged in all.
 */
export const Navigation = Schema.TaggedStruct('Navigation', {
  steps: Schema.Array(Step).check(Schema.isLengthBetween(1, stepsKept)),
  gestures: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: mostGestures })),
}).check(countsItsSteps)

export type Navigation = typeof Navigation.Type

/**
 * The merge rule: a gesture added to the navigation under way, or the first of a new one. The latest
 * `stepsKept` gestures are kept, an older one dropped, and every gesture is counted.
 */
export function merged(navigation: Navigation | undefined, step: Step): Navigation {
  if (navigation === undefined) return { _tag: 'Navigation', steps: [step], gestures: 1 }
  return {
    _tag: 'Navigation',
    steps: [...navigation.steps, step].slice(-stepsKept),
    gestures: Math.min(navigation.gestures + 1, mostGestures),
  }
}
