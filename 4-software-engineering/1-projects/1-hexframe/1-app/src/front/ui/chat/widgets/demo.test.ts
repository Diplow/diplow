import { describe, expect, it } from 'vitest'

import { m } from '#/paraglide/messages'

import {
  accessRefusalOf,
  around,
  editedOf,
  follow,
  nameRefusalOf,
  placesTo,
  readOnOf,
  stillRefused,
  tileRefusalOf,
  topicsOf,
  type HelpNode,
} from './demo'

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
  it('refuses an empty name and one past 32 characters', () => {
    expect(nameRefusalOf('  ')).toBe(m.error_iam_key_name_invalid())
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

const node = (
  id: string,
  children: Partial<Record<1 | 2 | 3 | 4 | 5 | 6, HelpNode>> = {},
): HelpNode => ({ id, title: id, preview: '', body: '', children })

const help = node('root', {
  1: node('system'),
  3: node('directions', { 1: node('six') }),
  4: node('context'),
  6: node('keys'),
})

describe('the way around Help', () => {
  it('follows a path of places, stopping at a gap', () => {
    expect(follow(help, [3, 1]).map(({ id }) => id)).toEqual(['root', 'directions', 'six'])
    expect(follow(help, [2, 1]).map(({ id }) => id)).toEqual(['root'])
  })

  it('lists every topic, the Root first, then each topic’s six in order', () => {
    expect(topicsOf(help).map(({ id }) => id)).toEqual([
      'root',
      'system',
      'directions',
      'six',
      'context',
      'keys',
    ])
  })

  it('finds the path to a topic by its id', () => {
    expect(placesTo(help, 'six')).toEqual([3, 1])
    expect(placesTo(help, 'root')).toEqual([])
    expect(placesTo(help, 'nowhere')).toBeUndefined()
  })

  it('goes round a frame clockwise, west to north-west', () => {
    expect(around(6, 1)).toBe(1)
    expect(around(3, 2)).toBe(5)
  })

  it('reads on below a topic, or round its own frame when nothing is below', () => {
    expect(readOnOf(help, [3]).map(({ id }) => id)).toEqual(['six'])
    expect(readOnOf(help, [6]).map(({ id }) => id)).toEqual(['system'])
    expect(readOnOf(help, [4]).map(({ id }) => id)).toEqual(['keys'])
    expect(readOnOf(help, []).map(({ id }) => id)).toEqual([
      'system',
      'directions',
      'context',
      'keys',
    ])
  })
})
