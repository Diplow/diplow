import type { KeyboardEvent } from 'react'

/** A shortcut: `KeyboardEvent.key`, with Shift, or with the command key (Control off a Mac). */
export interface Shortcut {
  key: string
  shift?: boolean
  mod?: boolean
}

const keyGlyphs: Record<string, string> = {
  Enter: '↵',
  Backspace: '⌫',
  Delete: '⌦',
  Escape: 'esc',
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
}

/** A shortcut as the keyboard shows it: ⌘, ⇧, then the key, a letter in capitals. */
function glyphs({ key, shift = false, mod = false }: Shortcut): string[] {
  const glyph = keyGlyphs[key] ?? (key.length === 1 ? key.toUpperCase() : key)
  return [...(mod ? ['⌘'] : []), ...(shift ? ['⇧'] : []), glyph]
}

/**
 * The shortcut as `aria-keyshortcuts` names it, so a screen reader says it: with `mod`, both the
 * command key and Control, as `pressed` takes either.
 */
export function ariaShortcut({ key, shift = false, mod = false }: Shortcut): string {
  const rest = (shift ? 'Shift+' : '') + (key === ' ' ? 'Space' : key)
  return mod ? `Meta+${rest} Control+${rest}` : rest
}

/** What `pressed` reads of a key press. */
type Press = Pick<KeyboardEvent, 'key' | 'shiftKey' | 'metaKey' | 'ctrlKey' | 'altKey'>

/** Whether a key press is the shortcut, its modifiers included: the command key or Control for `mod`. */
export const pressed = (shortcut: Shortcut | undefined, event: Press) =>
  shortcut !== undefined &&
  shortcut.key.toLowerCase() === event.key.toLowerCase() &&
  (shortcut.shift ?? false) === event.shiftKey &&
  (shortcut.mod ?? false) === (event.metaKey || event.ctrlKey) &&
  !event.altKey

/** A shortcut drawn key by key, for the eye: a screen reader hears `aria-keyshortcuts` instead. */
export function Keys({ shortcut }: { shortcut: Shortcut }) {
  return (
    <span className="inline-flex gap-[3px] font-mono text-[0.65625rem]" aria-hidden="true">
      {glyphs(shortcut).map((glyph) => (
        <kbd
          key={glyph}
          className="inline-block min-w-[18px] bg-current/14 px-[5px] pt-[3px] pb-0.5 text-center leading-none"
        >
          {glyph}
        </kbd>
      ))}
    </span>
  )
}
