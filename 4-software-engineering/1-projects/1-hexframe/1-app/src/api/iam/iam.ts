// IAM's server functions: signing up and in, the Session home reads before it renders, signed in or
// out (front/client/iam/guard.ts), and the Account's Keys: issuing, listing, revoking. The middleware
// has already put the request's Session on context. Signing out has no server function until the
// composer's `/sign-out` runs one.
import { createServerFn } from '@tanstack/react-start'
import { Schema } from 'effect'

import { keyNameBounds } from '#/domains/iam/entities'
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

/** The most UTF-16 units a reader's character takes here: an emoji is up to 19 (a family, skin toned). */
const unitsPerCharacter = 32

/**
 * What issuing a Key sends: its name. Bounded here, so nothing unbounded reaches IAM or Better Auth;
 * what a name must be is IAM's to say, on the field. IAM counts its characters as a reader does, so
 * the bound, in UTF-16 units, leaves room for its most characters, emoji each, and their spaces.
 */
export const KeyName = Schema.Struct({
  name: Schema.String.check(Schema.isMaxLength(keyNameBounds.max * unitsPerCharacter)),
})

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

/** The request's Session, or `SignedOut`: what home reads before anything renders. */
export const session = createServerFn({ method: 'GET' })
  .validator(Nothing)
  .handler(({ context }) => run(context, Iam.sessionOnly))

/** Issues a Key to the signed-in Account: the one answer that carries its secret. */
export const issueKey = createServerFn({ method: 'POST' })
  .validator(Schema.toStandardSchemaV1(KeyName))
  .handler(({ data, context }) => run(context, Iam.issueKey(data.name)))

/** The signed-in Account's Keys, the newest first, never their secrets. */
export const keys = createServerFn({ method: 'GET' })
  .validator(Nothing)
  .handler(({ context }) => run(context, Iam.keys))

/** Revokes one of the signed-in Account's Keys. */
export const revokeKey = createServerFn({ method: 'POST' })
  .validator(Schema.toStandardSchemaV1(KeyId))
  .handler(({ data, context }) => run(context, Iam.revokeKey(data.id)))
