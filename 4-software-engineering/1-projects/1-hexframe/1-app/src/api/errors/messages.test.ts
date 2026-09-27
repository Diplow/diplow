import { afterEach, describe, expect, it } from 'vitest'

import { overwriteGetLocale } from '#/paraglide/runtime'

import {
  CredentialsRejected,
  EmailMalformed,
  EmailTaken,
  PasswordLengthInvalid,
  SignedOut,
  TooManyAttempts,
} from '#/domains/iam/errors'

import { DevConflict, DevForbidden, DevInvalid, DevNotFound } from '../dev/failures'
import { Unexpected } from './failure'
import { messageFor } from './messages'

describe('the message table', () => {
  afterEach(() => {
    overwriteGetLocale(() => 'en')
  })

  it('takes the entry scoped to the call first', () => {
    expect(messageFor(new DevConflict(), 'submitDevTitle')).toBe('That title is taken.')
  })

  it("falls back to the kind's sentence outside that scope", () => {
    expect(messageFor(new DevConflict(), 'provokeWrite')).toBe(
      'This changed in the meantime. Reload, then try again.',
    )
    expect(messageFor(new DevInvalid({ fields: ['title'] }))).toBe('Some fields need another look.')
  })

  it('takes an unscoped entry in every scope', () => {
    const sentence =
      "This dev record doesn't exist. (The table's entry for DevNotFound, in every scope.)"
    expect(messageFor(new DevNotFound(), 'provokeRead')).toBe(sentence)
    expect(messageFor(new DevNotFound())).toBe(sentence)
  })

  it('has a sentence for a kind no entry names', () => {
    expect(messageFor(new DevForbidden())).toBe(
      "This belongs to someone who hasn't shared it with you.",
    )
    expect(messageFor(new Unexpected())).toMatch(/^Something went wrong on our side/)
  })

  it.each([
    [new CredentialsRejected({ fields: ['password'] }), 'Wrong email or password.'],
    [new EmailTaken({ fields: ['email'] }), 'An account already uses this email. Sign in instead.'],
    [new EmailMalformed({ fields: ['email'] }), 'Enter an email address, like name@example.com.'],
    [new PasswordLengthInvalid({ fields: ['password'] }), 'Use between 8 and 128 characters.'],
    [new TooManyAttempts(), 'Too many attempts. Wait a few seconds, then try again.'],
    [new SignedOut(), 'Sign in to go on.'],
  ])("words IAM's %s in its own sentence", (failure, sentence) => {
    expect(messageFor(failure, 'signIn')).toBe(sentence)
  })

  it("words IAM's refusals in French too", () => {
    overwriteGetLocale(() => 'fr')
    expect(messageFor(new CredentialsRejected({ fields: ['password'] }))).toBe(
      'E-mail ou mot de passe incorrect.',
    )
    expect(messageFor(new TooManyAttempts())).toBe(
      'Trop de tentatives. Patientez quelques secondes, puis réessayez.',
    )
  })

  it("speaks the page's language", () => {
    overwriteGetLocale(() => 'fr')
    expect(messageFor(new DevConflict(), 'submitDevTitle')).toBe('Ce titre est déjà pris.')
    expect(messageFor(new DevForbidden())).toBe(
      'Ceci appartient à quelqu’un qui ne l’a pas partagé avec vous.',
    )
  })
})
