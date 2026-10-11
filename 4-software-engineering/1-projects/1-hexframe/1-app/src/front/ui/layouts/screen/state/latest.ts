// Whether the conversation keeps its newest line in view, after each thing the reader does. The
// screen follows the conversation's foot as it grows or as its scroller shrinks while this holds.

/** What the reader did, as the conversation's scroller saw it then. */
export type Moment =
  /** Scrolled, by hand or as the screen followed the foot. */
  | { readonly kind: 'scrolled'; readonly atFoot: boolean }
  /** Pressed or keyed something in the conversation, a day earlier asked for included. */
  | { readonly kind: 'acted'; readonly atFoot: boolean; readonly scrolls: boolean }
  /** Pressed or keyed something at the chat's foot, writing what they will send. */
  | { readonly kind: 'wrote' }

/**
 * Kept at its foot: while the reader is there, a conversation that scrolls; not once they act in one
 * too short to scroll, so what they asked for stays where it shows; again once they write at the foot,
 * so what they send shows.
 */
export function keptAtFoot(moment: Moment): boolean {
  switch (moment.kind) {
    case 'scrolled':
      return moment.atFoot
    case 'acted':
      return moment.scrolls && moment.atFoot
    case 'wrote':
      return true
  }
}
