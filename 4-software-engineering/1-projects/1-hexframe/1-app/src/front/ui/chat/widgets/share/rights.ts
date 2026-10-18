// What someone may do on a tile, in words: the rights a value gives, read first, one after another,
// "read, write", or none. Which rights a value gives is Mapping's to say; the caller hands them over
// and this words them. What the share widget's rows say, and the timeline's line about a tile shared
// with the user, so both say it alike. And each choice the share widget offers, as its button says it.
import { m } from '#/paraglide/messages'

/** A right someone may hold on a tile: read it, write it, or run the agent at it. */
type Right = 'read' | 'write' | '@'

/** Each right, in words. */
const words: Record<Right, () => string> = {
  read: m.widget_share_read,
  write: m.widget_share_write,
  '@': m.widget_share_agent,
}

/** What some rights let someone do, in words, in their order: "read, write", or "none". */
export function rightsSaid(rights: ReadonlyArray<Right>): string {
  if (rights.length === 0) return m.widget_share_none()
  return rights.map((right) => words[right]()).join(m.widget_share_rights_joiner())
}

/**
 * What the owner sets on a tile for someone: a value, none to read, write and @, or what the tile
 * above has. Which of them a row offers is its caller's, as Mapping decides it.
 */
export type ShareChoice = 'none' | 'read' | 'read+write' | 'read+@' | 'read+write+@' | 'inherit'

/** Each choice, as its button says it. */
const choices: Record<ShareChoice, () => string> = {
  none: m.widget_share_choice_none,
  read: m.widget_share_choice_read,
  'read+write': m.widget_share_choice_read_write,
  'read+@': m.widget_share_choice_read_agent,
  'read+write+@': m.widget_share_choice_read_write_agent,
  inherit: m.widget_share_choice_inherit,
}

/** A choice, as its button says it: "Read and write". */
export const choiceSaid = (choice: ShareChoice) => choices[choice]()
