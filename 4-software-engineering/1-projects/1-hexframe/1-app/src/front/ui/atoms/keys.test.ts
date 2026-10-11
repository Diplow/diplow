import { describe, expect, it } from 'vitest'

import { ariaShortcut, pressed } from './keys'

const press = (
  key: string,
  modifiers: { shift?: boolean; meta?: boolean; ctrl?: boolean; alt?: boolean } = {},
) => ({
  key,
  shiftKey: modifiers.shift ?? false,
  metaKey: modifiers.meta ?? false,
  ctrlKey: modifiers.ctrl ?? false,
  altKey: modifiers.alt ?? false,
})

describe('pressed', () => {
  it('takes a letter in either case', () => {
    expect(pressed({ key: 'e' }, press('E'))).toBe(true)
  })

  it('tells Shift+Enter from Enter, both ways', () => {
    expect(pressed({ key: 'Enter' }, press('Enter', { shift: true }))).toBe(false)
    expect(pressed({ key: 'Enter', shift: true }, press('Enter'))).toBe(false)
    expect(pressed({ key: 'Enter', shift: true }, press('Enter', { shift: true }))).toBe(true)
  })

  it('takes the command key or Control for mod, and neither without it', () => {
    expect(pressed({ key: 'Enter', mod: true }, press('Enter', { meta: true }))).toBe(true)
    expect(pressed({ key: 'Enter', mod: true }, press('Enter', { ctrl: true }))).toBe(true)
    expect(pressed({ key: 'Enter', mod: true }, press('Enter'))).toBe(false)
    expect(pressed({ key: 'e' }, press('e', { ctrl: true }))).toBe(false)
  })

  it('refuses a press with Alt', () => {
    expect(pressed({ key: 'e' }, press('e', { alt: true }))).toBe(false)
  })

  it('is no press without a shortcut', () => {
    expect(pressed(undefined, press('e'))).toBe(false)
  })
})

describe('ariaShortcut', () => {
  it('names Shift and the key as aria-keyshortcuts does', () => {
    expect(ariaShortcut({ key: 'Enter', shift: true })).toBe('Shift+Enter')
    expect(ariaShortcut({ key: ' ' })).toBe('Space')
  })

  it('names both the command key and Control for mod', () => {
    expect(ariaShortcut({ key: 'Enter', mod: true })).toBe('Meta+Enter Control+Enter')
  })
})
