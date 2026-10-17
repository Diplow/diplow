// The shortcuts `?` shows, grouped by where they work. A proposal: TanStack Hotkeys is chosen in
// STACK.md but not installed, and no key here is bound yet but the composer's and the widget's.
import { m } from '#/paraglide/messages'

import type { Shortcut } from '../../../atoms/keys'

interface ShortcutRow {
  readonly does: () => string
  /** Its keys: one, or several that each do it, the arrows. */
  readonly keys: readonly Shortcut[]
}

export interface ShortcutGroup {
  readonly where: () => string
  readonly rows: readonly ShortcutRow[]
}

export const shortcuts: readonly ShortcutGroup[] = [
  {
    where: m.widget_help_keys_canvas,
    rows: [
      { does: m.widget_help_key_open, keys: [{ key: 'Enter' }] },
      { does: m.widget_help_key_into, keys: [{ key: 'Enter', shift: true }] },
      { does: m.widget_help_key_out, keys: [{ key: 'Escape' }] },
      {
        does: m.widget_help_key_between,
        keys: [
          { key: 'ArrowLeft' },
          { key: 'ArrowRight' },
          { key: 'ArrowUp' },
          { key: 'ArrowDown' },
        ],
      },
      { does: m.widget_help_key_menu, keys: [{ key: 'F10', shift: true }] },
      { does: m.widget_help_key_edit, keys: [{ key: 'e' }] },
      { does: m.widget_help_key_new, keys: [{ key: 'n' }] },
      { does: m.widget_help_key_delete, keys: [{ key: 'Backspace' }] },
    ],
  },
  {
    where: m.widget_help_keys_conversation,
    rows: [
      { does: m.widget_help_key_send, keys: [{ key: 'Enter' }] },
      { does: m.widget_help_key_line, keys: [{ key: 'Enter', shift: true }] },
      { does: m.widget_help_key_command, keys: [{ key: '/' }] },
      { does: m.widget_help_key_name, keys: [{ key: '@' }] },
      { does: m.widget_help_key_accept, keys: [{ key: 'Enter', mod: true }] },
    ],
  },
  {
    where: m.widget_help_keys_anywhere,
    rows: [
      { does: m.widget_help_key_write, keys: [{ key: 'k', mod: true }] },
      { does: m.widget_help_key_these, keys: [{ key: '?' }] },
    ],
  },
]
