// IAM's server functions: signing up, in and out, the Session a page only a signed-in Account sees is
// guarded by (front/client/iam/guard.ts), and the Account's Keys: issuing, listing, revoking. The
// middleware has already put the request's Session on context.
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

/**
 * What issuing a Key sends: its name. Bounded here, so nothing unbounded reaches Better Auth; what a
 * name must be is IAM's to say, on the field.
 */
export const KeyName = Schema.Struct({ name: Schema.String.check(Schema.isMaxLength(256)) })

/** What revoking a Key sends: its id, as Better Auth makes them: letters and digits. */
export const KeyId = Schema.Struct({
  id: Schema.String.check(Schema.isPattern(/^[A-Za-z0-9]{1,128}$/)),
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
  .handler(({ context }) => run(context, Iam.sessionOnly))

/**
 * Issues a Key to the signed-in Account: the one answer that carries its secret.
 *
 * @public The Keys page (HEX-44) is the first caller of the three Key functions; it drops the tag.
 */
export const issueKey = createServerFn({ method: 'POST' })
  .validator(Schema.toStandardSchemaV1(KeyName))
  .handler(({ data, context }) => run(context, Iam.issueKey(data.name)))

/**
 * The signed-in Account's Keys, the newest first, never their secrets.
 *
 * @public The Keys page (HEX-44) is its first caller.
 */
export const keys = createServerFn({ method: 'GET' })
  .validator(Nothing)
  .handler(({ context }) => run(context, Iam.keys))

/**
 * Revokes one of the signed-in Account's Keys.
 *
 * @public The Keys page (HEX-44) is its first caller.
 */
export const revokeKey = createServerFn({ method: 'POST' })
  .validator(Schema.toStandardSchemaV1(KeyId))
  .handler(({ data, context }) => run(context, Iam.revokeKey(data.id)))
