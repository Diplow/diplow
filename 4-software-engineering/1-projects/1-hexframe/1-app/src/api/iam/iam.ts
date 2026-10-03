// IAM's server functions: signing up, in and out, and the Session a page only a signed-in Account
// sees is guarded by (./guard.ts). The middleware has already put the request's Session on context.
import { createServerFn } from '@tanstack/react-start'
import { Schema } from 'effect'

import * as Iam from '#/domains/iam/iam'

import { run } from '../server/run'

/**
 * What a sign-up or a sign-in sends. Bounded here, so nothing unbounded reaches Better Auth; what an
 * email or a password must be is IAM's to say, on the field at fault.
 */
export const Credentials = Schema.Struct({
  email: Schema.String.check(Schema.isMaxLength(320)),
  password: Schema.String.check(Schema.isMaxLength(1024)),
})

/** A call that takes nothing. */
const Nothing = Schema.toStandardSchemaV1(Schema.Undefined)

export const signUp = createServerFn({ method: 'POST' })
  .validator(Schema.toStandardSchemaV1(Credentials))
  .handler(({ data, context }) => run(context, Iam.signUp(data)))

export const signIn = createServerFn({ method: 'POST' })
  .validator(Schema.toStandardSchemaV1(Credentials))
  .handler(({ data, context }) => run(context, Iam.signIn(data)))

export const signOut = createServerFn({ method: 'POST' })
  .validator(Nothing)
  .handler(({ context }) => run(context, Iam.signOut))

/** The request's Session, or `SignedOut`: what a guarded page reads before anything renders. */
export const session = createServerFn({ method: 'GET' })
  .validator(Nothing)
  .handler(({ context }) => run(context, Iam.signedIn))
