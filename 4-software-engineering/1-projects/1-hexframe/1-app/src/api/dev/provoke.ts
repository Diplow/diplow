// The server functions /dev/errors calls to provoke every channel: each ends with the outcome it is
// asked for, through the helper like any other. Outside dev and previews they answer NotFound.
import { createServerFn } from '@tanstack/react-start'
import { Effect, Schema } from 'effect'

import { kinds } from '#/domains/kind'

import { RequestContext, run } from '../server/run'
import { DevConflict, DevForbidden, DevInvalid, DevNotFound, DevUnauthenticated } from './failures'

/** What a provoked call ends with: a success, or a failure of one kind. */
export const outcomes = ['Success', ...kinds] as const

export type ProvokedOutcome = (typeof outcomes)[number]

const Provoke = Schema.Struct({ outcome: Schema.Literals(outcomes) })

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

export const provokeRead = createServerFn({ method: 'GET' })
  .validator(Schema.toStandardSchemaV1(Provoke))
  .handler(({ data, context }) => run(context, provoked(data.outcome)))

export const provokeWrite = createServerFn({ method: 'POST' })
  .validator(Schema.toStandardSchemaV1(Provoke))
  .handler(({ data, context }) => run(context, provoked(data.outcome)))

/** A form's write: an empty title is Invalid on its field, "taken" is a Conflict, anything else saves. */
export const savedDevTitle = (input: string) =>
  Effect.gen(function* () {
    yield* devPagesOnly
    const title = input.trim()
    if (title === '') return yield* new DevInvalid({ fields: ['title'] })
    if (title.toLowerCase() === 'taken') return yield* new DevConflict()
    return { title }
  })

const DevTitle = Schema.Struct({ title: Schema.String })

export const submitDevTitle = createServerFn({ method: 'POST' })
  .validator(Schema.toStandardSchemaV1(DevTitle))
  .handler(({ data, context }) => run(context, savedDevTitle(data.title)))
