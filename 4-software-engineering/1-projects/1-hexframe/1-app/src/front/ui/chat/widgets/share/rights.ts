// What someone may do on a tile, in words: the rights a value gives, read first, one after another,
// "read, write", or none. What the share widget's rows say, and the timeline's line about a tile
// shared with the user, so both say it alike.
import { m } from '#/paraglide/messages'

/** A value someone has on a tile: none, or the rights it gives, read always among them. */
export type Rights = 'none' | 'read' | 'read+write' | 'read+@' | 'read+write+@'

const read = m.widget_share_read
const write = m.widget_share_write
const agent = m.widget_share_agent

/** The words of each right a value gives, in order. */
const given: Record<Rights, readonly (() => string)[]> = {
  none: [],
  read: [read],
  'read+write': [read, write],
  'read+@': [read, agent],
  'read+write+@': [read, write, agent],
}

/** What a value lets someone do, in words: "read, write", or "none". */
export function rightsSaid(rights: Rights): string {
  const words = given[rights]
  if (words.length === 0) return m.widget_share_none()
  return words.map((word) => word()).join(m.widget_share_rights_joiner())
}
