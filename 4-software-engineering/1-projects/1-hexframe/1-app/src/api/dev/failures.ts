// A failure of each kind a domain may declare, named for its kind, not in a domain's language, so nobody
// mistakes them for Mapping's or IAM's: the stand-ins the tests of the error model and of the client's
// channels fail with, where no domain's refusal is the point.
import { Schema } from 'effect'

import { invalid, kind } from '#/domains/kind'

export class DevUnauthenticated extends Schema.TaggedError<DevUnauthenticated>()(
  'DevUnauthenticated',
  { kind: kind('Unauthenticated') },
) {}

export class DevForbidden extends Schema.TaggedError<DevForbidden>()('DevForbidden', {
  kind: kind('Forbidden'),
}) {}

export class DevInvalid extends Schema.TaggedError<DevInvalid>()('DevInvalid', invalid) {}

class DevNotFound extends Schema.TaggedError<DevNotFound>()('DevNotFound', {
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
