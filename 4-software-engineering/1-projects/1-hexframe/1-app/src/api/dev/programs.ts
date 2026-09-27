// The programs behind /dev/errors' server functions (./provoke.ts): each ends with the outcome it is
// asked for. Apart from those functions, so the page's client bundle, which imports them, never reaches
// the server function helper: Start strips what a handler alone uses, not what a module exports.
import { Effect } from 'effect'

import { RequestContext } from '../server/run'
import {
  DevConflict,
  DevForbidden,
  DevInvalid,
  DevNotFound,
  DevUnauthenticated,
  type ProvokedOutcome,
} from './failures'

const failures = {
  Unauthenticated: () => new DevUnauthenticated(),
  Forbidden: () => new DevForbidden(),
  Invalid: () => new DevInvalid({ fields: ['outcome'] }),
  NotFound: () => new DevNotFound(),
  Conflict: () => new DevConflict(),
}

const devPagesOnly = __DEV_PAGES__ ? Effect.void : Effect.fail(new DevNotFound())

/** A success answers with the request id, the one the failures carry too, so the page can show both. */
export const provoked = (outcome: ProvokedOutcome) =>
  Effect.gen(function* () {
    yield* devPagesOnly
    const { requestId } = yield* RequestContext
    if (outcome === 'Success') return { requestId }
    // A bug, not a failure a domain declares: the helper reports it and sends it as Unexpected.
    if (outcome === 'Unexpected') return yield* Effect.die(new Error('Provoked on /dev/errors'))
    return yield* failures[outcome]()
  })

/** A form's write: an empty title is Invalid on its field, "taken" is a Conflict, anything else saves. */
export const savedDevTitle = (input: string) =>
  Effect.gen(function* () {
    yield* devPagesOnly
    const title = input.trim()
    if (title === '') return yield* new DevInvalid({ fields: ['title'] })
    if (title.toLowerCase() === 'taken') return yield* new DevConflict()
    return { title }
  })
