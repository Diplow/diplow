// An Account's place in an Organization: its role there. Pure, part of IAM's door: the Members widget
// offers the two roles.
import { Schema } from 'effect'

/**
 * What an Account is in an Organization: an `admin`, who manages its members and stands for it, so
 * Mapping counts them as its System's owner, or a `member`.
 */
export const Role = Schema.Literals(['admin', 'member'])

export type Role = typeof Role.Type
