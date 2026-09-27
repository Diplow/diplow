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

export const iamFailures = [
  SignedOut,
  CredentialsRejected,
  EmailTaken,
  EmailMalformed,
  PasswordLengthInvalid,
] as const
