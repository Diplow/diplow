import { describe, expect, it } from 'vitest'

import { m } from '#/paraglide/messages'

import { accessRefusalOf, editedOf, nameRefusalOf, stillRefused, tileRefusalOf } from './demo'

const words = { title: 'Tooling', preview: 'What I use.', body: '' }

describe('the tile widget’s demo', () => {
  it('refuses no title and a preview past its limit, each on its field', () => {
    expect(tileRefusalOf(words, 350)).toBeUndefined()
    expect(tileRefusalOf({ ...words, title: '  ', preview: 'a'.repeat(351) }, 350)).toEqual({
      title: m.error_mapping_title_missing(),
      preview: m.error_mapping_preview_too_long(),
    })
    expect(tileRefusalOf({ ...words, preview: '👩‍💻'.repeat(350) }, 350)).toBeUndefined()
  })

  it('clears a refusal once its field changes, and only then', () => {
    const refused = { title: 'no title', preview: 'too long' }
    expect(stillRefused(refused, words, { ...words, title: 'Tools' })).toEqual({
      preview: 'too long',
    })
    expect(stillRefused(refused, words, { ...words, title: 'Tools', preview: '' })).toBeUndefined()
    expect(stillRefused(undefined, words, words)).toBeUndefined()
  })

  it('marks the fields that differ from what was read', () => {
    expect(editedOf({ ...words, body: 'More' }, words)).toEqual(['body'])
    expect(editedOf(words, words)).toEqual([])
  })
})

describe('the key and sign-in widgets’ demo', () => {
  it('refuses an empty name and one past 32 characters, as IAM counts them', () => {
    expect(nameRefusalOf('')).toBe(m.error_iam_key_name_invalid())
    expect(nameRefusalOf('a'.repeat(33))).toBe(m.error_iam_key_name_invalid())
    expect(nameRefusalOf('Claude Code, laptop')).toBeUndefined()
  })

  it('refuses a malformed email first, then a password out of bounds for signing up', () => {
    expect(accessRefusalOf('sign-in', 'nope', 'secret')).toEqual({
      email: m.error_iam_email_malformed(),
    })
    expect(accessRefusalOf('sign-up', 'a@b.co', 'short')).toEqual({
      password: m.error_iam_password_length(),
    })
    expect(accessRefusalOf('sign-in', 'a@b.co', 'short')).toBeUndefined()
    expect(accessRefusalOf('sign-in', 'a@b.co', '')).toEqual({
      password: m.error_iam_credentials_rejected(),
    })
  })
})
