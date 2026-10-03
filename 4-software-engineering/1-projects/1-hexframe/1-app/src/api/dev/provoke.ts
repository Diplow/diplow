// The server functions /dev/errors calls to provoke every channel: each ends with the outcome it is
// asked for, through the helper like any other. Outside dev and previews they answer NotFound.
import { createServerFn } from '@tanstack/react-start'
import { Schema } from 'effect'

import { run } from '../server/run'
import { outcomes } from './failures'
import { provoked, savedDevTitle } from './programs'

const Provoke = Schema.Struct({ outcome: Schema.Literals(outcomes) })

export const provokeRead = createServerFn({ method: 'GET' })
  .validator(Schema.toStandardSchemaV1(Provoke))
  .handler(({ data, context }) => run(context, provoked(data.outcome)))

export const provokeWrite = createServerFn({ method: 'POST' })
  .validator(Schema.toStandardSchemaV1(Provoke))
  .handler(({ data, context }) => run(context, provoked(data.outcome)))

const DevTitle = Schema.Struct({ title: Schema.String })

export const submitDevTitle = createServerFn({ method: 'POST' })
  .validator(Schema.toStandardSchemaV1(DevTitle))
  .handler(({ data, context }) => run(context, savedDevTitle(data.title)))
