// IAM's errors, in its language, each with the kind the client routes it by (src/domains/kind.ts).
import { Schema } from 'effect'

import { invalid, kind } from '../kind'
import { Entitlement } from './entities'

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

/** The Account may not do this: it lacks the Entitlement, until it pays for it. */
export class EntitlementMissing extends Schema.TaggedError<EntitlementMissing>()(
  'EntitlementMissing',
  { kind: kind('Forbidden'), entitlement: Entitlement },
) {}

/**
 * No Organization the Account belongs to has this star: none has it, or the Account is not one of its
 * members. Which of the two is not said.
 */
export class OrganizationNotFound extends Schema.TaggedError<OrganizationNotFound>()(
  'OrganizationNotFound',
  { kind: kind('NotFound') },
) {}

/** The Account is a member of the Organization, not an admin: only an admin manages its members. */
export class AdminRequired extends Schema.TaggedError<AdminRequired>()('AdminRequired', {
  kind: kind('Forbidden'),
}) {}

/**
 * The change would leave the Organization without an admin who joined it of their own accord: that
 * last can neither leave, nor be removed, nor be made a member. An admin only added may always leave.
 */
export class LastAdmin extends Schema.TaggedError<LastAdmin>()('LastAdmin', {
  kind: kind('Conflict'),
}) {}

/** The star named belongs to no Account: an Organization's, or none. Only an Account joins one. */
export class AccountNotFound extends Schema.TaggedError<AccountNotFound>()('AccountNotFound', {
  kind: kind('NotFound'),
}) {}

/** The Account named is a member of the Organization already. */
export class AlreadyMember extends Schema.TaggedError<AlreadyMember>()('AlreadyMember', {
  kind: kind('Conflict'),
}) {}

/** The Account named is no member of the Organization. */
export class MemberNotFound extends Schema.TaggedError<MemberNotFound>()('MemberNotFound', {
  kind: kind('NotFound'),
}) {}

/**
 * A Group's name is blank, or longer than 40 characters, counted as a reader counts them
 * (`groupNameBounds`).
 */
export class GroupNameInvalid extends Schema.TaggedError<GroupNameInvalid>()(
  'GroupNameInvalid',
  invalid,
) {}

/** Another Group of the Organization has this name already, whatever its case. */
export class GroupNameTaken extends Schema.TaggedError<GroupNameTaken>()(
  'GroupNameTaken',
  invalid,
) {}

/**
 * No Group of this id: none has it, it was deleted, or it belongs to no Organization the Account is
 * a member of. Which is not said.
 */
export class GroupNotFound extends Schema.TaggedError<GroupNotFound>()('GroupNotFound', {
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
  EntitlementMissing,
  OrganizationNotFound,
  AdminRequired,
  LastAdmin,
  AccountNotFound,
  AlreadyMember,
  MemberNotFound,
  GroupNameInvalid,
  GroupNameTaken,
  GroupNotFound,
] as const
