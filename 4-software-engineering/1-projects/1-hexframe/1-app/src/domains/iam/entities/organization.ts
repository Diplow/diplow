// An Account's place in an Organization: its role there; a Group of an Organization's own, by its
// id (its name's rule is `./names.ts`'s); and how a request to join stands. Pure, part of IAM's door:
// the Members widget offers the two roles, a Group crosses the wire by its id, and an admin's
// timeline shows a request as it stands.
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

/**
 * How a request to join an Organization, or one of its Groups, stands: waiting for one of its
 * admins, accepted, or declined (HEX-138).
 */
export const JoinState = Schema.Literals(['open', 'accepted', 'declined'])

export type JoinState = typeof JoinState.Type
