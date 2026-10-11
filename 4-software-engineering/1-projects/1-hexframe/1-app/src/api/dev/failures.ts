// A failure of each kind the tests need a stand-in for, named for its kind, not in a domain's
// language, so nobody mistakes them for Mapping's or IAM's: what the tests of the error model and of
// the client's channels fail with, where no domain's refusal is the point.
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

export class DevConflict extends Schema.TaggedError<DevConflict>()('DevConflict', {
  kind: kind('Conflict'),
}) {}

export const devFailures = [DevUnauthenticated, DevForbidden, DevInvalid, DevConflict] as const
