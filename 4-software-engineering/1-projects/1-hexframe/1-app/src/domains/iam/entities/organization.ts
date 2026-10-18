// An Account's place in an Organization: its role there; and a Group of an Organization's own, by its
// id (its name's rule is `./names.ts`'s). Pure, part of IAM's door: the Members widget offers the two
// roles, and a Group crosses the wire by its id.
import { Schema } from 'effect'

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
