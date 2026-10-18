// An Account's place in an Organization: its role there; and a Group of an Organization's own, by its
// id and its name, IAM's rule for which: trimmed, then counted as a reader counts it, so the Groups
// widget's count and IAM's refusal agree. Pure, part of IAM's door: the Members widget offers the two
// roles, the Groups widget reads the bounds of a name, and a Group crosses the wire by its id.
import { Schema } from 'effect'

import { charactersIn } from './key'

/**
 * What an Account is in an Organization: an `admin`, who manages its members and stands for it, so
 * Mapping counts them as its System's owner, or a `member`.
 */
export const Role = Schema.Literals(['admin', 'member'])

export type Role = typeof Role.Type

/**
 * A Group of an Organization's own, by its id, a UUID IAM makes: what the Groups widget changes it by,
 * and what a Grant to it names, a Group having no star to be named by (HEX-137).
 */
export const GroupId = Schema.String.check(Schema.isUUID())

/** The fewest and the most characters a Group's name holds, so its members tell their Groups apart. */
export const groupNameBounds = { min: 1, max: 40 } as const

/**
 * The name a Group is given, trimmed, or `undefined` when it holds fewer or more characters than
 * `groupNameBounds`, counted as a reader counts them.
 */
export function groupNameOf(name: string): string | undefined {
  const trimmed = name.trim()
  const characters = charactersIn(trimmed)
  return characters >= groupNameBounds.min && characters <= groupNameBounds.max
    ? trimmed
    : undefined
}

/**
 * Whether two names of Groups are one, as an Organization holds them apart: whatever their case, so
 * `Design` and `design` never stand side by side, folded the same way whatever the locale of the
 * machine comparing them, the server's and the browser's alike.
 */
export const sameGroupName = (one: string, other: string) =>
  one.toLowerCase() === other.toLowerCase()
