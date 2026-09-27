import { afterEach, describe, expect, it } from 'vitest'

import { overwriteGetLocale } from '#/paraglide/runtime'

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
    expect(messageFor(new DevForbidden())).toBe("You don't have access to this.")
    expect(messageFor(new Unexpected())).toMatch(/^Something went wrong on our side/)
  })

  it("speaks the page's language", () => {
    overwriteGetLocale(() => 'fr')
    expect(messageFor(new DevConflict(), 'submitDevTitle')).toBe('Ce titre est déjà pris.')
    expect(messageFor(new DevForbidden())).toBe('Vous n’avez pas accès à ceci.')
  })
})
