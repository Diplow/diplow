// The errors /dev/errors provokes, one per kind a domain may declare. Named for their kind, not in a
// domain's language, so nobody mistakes them for Mapping's or IAM's; the first domains bring real ones.
import { Schema } from 'effect'

import { invalid, kind, kinds } from '#/domains/kind'

export class DevUnauthenticated extends Schema.TaggedError<DevUnauthenticated>()(
  'DevUnauthenticated',
  { kind: kind('Unauthenticated') },
) {}

export class DevForbidden extends Schema.TaggedError<DevForbidden>()('DevForbidden', {
  kind: kind('Forbidden'),
}) {}

export class DevInvalid extends Schema.TaggedError<DevInvalid>()('DevInvalid', invalid) {}

export class DevNotFound extends Schema.TaggedError<DevNotFound>()('DevNotFound', {
  kind: kind('NotFound'),
}) {}

export class DevConflict extends Schema.TaggedError<DevConflict>()('DevConflict', {
  kind: kind('Conflict'),
}) {}

export const devFailures = [
  DevUnauthenticated,
  DevForbidden,
  DevInvalid,
  DevNotFound,
  DevConflict,
] as const

/** What a provoked call ends with: a success, or a failure of one kind. */
export const outcomes = ['Success', ...kinds] as const

export type ProvokedOutcome = (typeof outcomes)[number]
