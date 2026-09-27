// The programs behind /dev/errors' server functions (./provoke.ts): each ends with the outcome it is
// asked for. They sit in a module of their own because they reach `run.ts`: the page imports the
// server functions, and only their handlers import this module, which Start strips from the client.
// Were the programs exported beside the server functions, the page would reach `run.ts` through them.
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
