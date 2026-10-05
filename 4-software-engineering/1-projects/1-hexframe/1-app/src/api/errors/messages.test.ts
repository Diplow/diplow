import { afterEach, describe, expect, it } from 'vitest'

import { overwriteGetLocale } from '#/paraglide/runtime'

import {
  CredentialsRejected,
  EmailMalformed,
  EmailTaken,
  KeyNameInvalid,
  KeyNotFound,
  PasswordLengthInvalid,
  SessionRequired,
  SignedOut,
  TooManyAttempts,
} from '#/domains/iam/errors'
import {
  DirectionTaken,
  MovedUnderItself,
  PreviewTooLong,
  RootFixed,
  TileNotFound,
  TitleMissing,
} from '#/domains/mapping/errors'

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
    [
      new SessionRequired(),
      'Keys and your account can only be changed from a signed-in browser, not with a key.',
    ],
    [new KeyNameInvalid({ fields: ['name'] }), 'Give the key a name of 1 to 32 characters.'],
    [new KeyNotFound(), "This key doesn't exist, or was already revoked."],
  ])("words IAM's %s in its own sentence", (failure, sentence) => {
    expect(messageFor(failure, 'signIn')).toBe(sentence)
  })

  it.each([
    [new CredentialsRejected({ fields: ['password'] }), 'E-mail ou mot de passe incorrect.'],
    [
      new EmailTaken({ fields: ['email'] }),
      'Un compte utilise déjà cet e-mail. Connectez-vous plutôt.',
    ],
    [
      new EmailMalformed({ fields: ['email'] }),
      'Saisissez une adresse e-mail, comme nom@exemple.fr.',
    ],
    [new PasswordLengthInvalid({ fields: ['password'] }), 'Utilisez entre 8 et 128 caractères.'],
    [new TooManyAttempts(), 'Trop de tentatives. Patientez quelques secondes, puis réessayez.'],
    [new SignedOut(), 'Connectez-vous pour continuer.'],
    [
      new SessionRequired(),
      'Les clés et votre compte ne se modifient que depuis un navigateur connecté, pas avec une clé.',
    ],
    [new KeyNameInvalid({ fields: ['name'] }), 'Donnez à la clé un nom de 1 à 32 caractères.'],
    [new KeyNotFound(), 'Cette clé n’existe pas, ou a déjà été révoquée.'],
  ])("words IAM's %s in French too", (failure, sentence) => {
    overwriteGetLocale(() => 'fr')
    expect(messageFor(failure, 'signIn')).toBe(sentence)
  })

  it.each([
    [new TileNotFound(), "This tile doesn't exist, or no longer does."],
    [new TitleMissing({ fields: ['title'] }), 'Give this tile a title.'],
    [new PreviewTooLong({ fields: ['preview'] }), 'Keep the preview to 350 characters.'],
    [
      new DirectionTaken(),
      'This place already holds a tile. Pick a free one, or move that tile first.',
    ],
    [new MovedUnderItself(), "A tile can't move under itself or one of its own children."],
    [new RootFixed(), "Your root tile is you: it can't be moved or deleted."],
  ])("words Mapping's %s in its own sentence", (failure, sentence) => {
    expect(messageFor(failure, 'moveTile')).toBe(sentence)
  })

  it('words a swap along one line apart from a move below itself', () => {
    for (const scope of ['swapTiles', 'swap_tiles']) {
      expect(messageFor(new MovedUnderItself(), scope)).toBe(
        'Two tiles can only swap when neither lies below the other.',
      )
    }
    overwriteGetLocale(() => 'fr')
    expect(messageFor(new MovedUnderItself(), 'swapTiles')).toBe(
      'Deux tuiles ne s’échangent que si aucune n’est sous l’autre.',
    )
  })

  it.each([
    [new TileNotFound(), 'Cette tuile n’existe pas, ou plus.'],
    [new TitleMissing({ fields: ['title'] }), 'Donnez un titre à cette tuile.'],
    [new PreviewTooLong({ fields: ['preview'] }), 'Limitez l’aperçu à 350 caractères.'],
    [
      new DirectionTaken(),
      'Cette place a déjà une tuile. Choisissez-en une libre, ou déplacez d’abord cette tuile.',
    ],
    [
      new MovedUnderItself(),
      'Une tuile ne peut pas aller sous elle-même ni sous l’un de ses enfants.',
    ],
    [
      new RootFixed(),
      'Votre tuile racine, c’est vous : elle ne peut être ni déplacée ni supprimée.',
    ],
  ])("words Mapping's %s in French too", (failure, sentence) => {
    overwriteGetLocale(() => 'fr')
    expect(messageFor(failure, 'moveTile')).toBe(sentence)
  })

  it("speaks the page's language", () => {
    overwriteGetLocale(() => 'fr')
    expect(messageFor(new DevConflict(), 'submitDevTitle')).toBe('Ce titre est déjà pris.')
    expect(messageFor(new DevForbidden())).toBe(
      'Ceci appartient à quelqu’un qui ne l’a pas partagé avec vous.',
    )
  })
})
