// IAM's errors, in its language, each with the kind the client routes it by (src/domains/kind.ts).
import { Schema } from 'effect'

import { invalid, kind } from '../kind'

/** Nobody is signed in where a Session is needed. */
export class SignedOut extends Schema.TaggedError<SignedOut>()('SignedOut', {
  kind: kind('Unauthenticated'),
}) {}

/** No Account has this email and password. Which of the two is wrong is not said. */
export class CredentialsRejected extends Schema.TaggedError<CredentialsRejected>()(
  'CredentialsRejected',
  invalid,
) {}

/** An Account already signs in with this email. */
export class EmailTaken extends Schema.TaggedError<EmailTaken>()('EmailTaken', invalid) {}

/** The email is not one. */
export class EmailMalformed extends Schema.TaggedError<EmailMalformed>()(
  'EmailMalformed',
  invalid,
) {}

/** The password is shorter or longer than IAM accepts. */
export class PasswordLengthInvalid extends Schema.TaggedError<PasswordLengthInvalid>()(
  'PasswordLengthInvalid',
  invalid,
) {}

/** Too many sign-ups or sign-ins from this place in a short while: wait, then try again. */
export class TooManyAttempts extends Schema.TaggedError<TooManyAttempts>()('TooManyAttempts', {
  kind: kind('Forbidden'),
}) {}

/**
 * A Key proves the request, where only a Session may act: issuing, listing or revoking Keys, or changing
 * the Account itself. So a leaked Key cannot keep itself alive.
 */
export class SessionRequired extends Schema.TaggedError<SessionRequired>()('SessionRequired', {
  kind: kind('Forbidden'),
}) {}

/** A Key's name is empty, or longer than 32 characters. */
export class KeyNameInvalid extends Schema.TaggedError<KeyNameInvalid>()(
  'KeyNameInvalid',
  invalid,
) {}

/** No Key of this id among the Account's: it was revoked, or it is someone else's. */
export class KeyNotFound extends Schema.TaggedError<KeyNotFound>()('KeyNotFound', {
  kind: kind('NotFound'),
}) {}

export const iamFailures = [
  SignedOut,
  CredentialsRejected,
  EmailTaken,
  EmailMalformed,
  PasswordLengthInvalid,
  TooManyAttempts,
  SessionRequired,
  KeyNameInvalid,
  KeyNotFound,
] as const
