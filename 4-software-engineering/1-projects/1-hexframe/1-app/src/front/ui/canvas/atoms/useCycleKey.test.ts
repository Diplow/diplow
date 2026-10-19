// @vitest-environment happy-dom
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useCycleKey } from './useCycleKey'

let canvas: Element
let onCycle: ReturnType<typeof vi.fn<() => void>>

beforeEach(() => {
  canvas = document.createElement('div')
  document.body.append(canvas)
  onCycle = vi.fn<() => void>()
})

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
})

/** The canvas listening for C, or, `listening: false`, given nothing to do with it. */
function listen({ listening = true } = {}) {
  return renderHook(() => {
    useCycleKey({ current: canvas }, listening ? onCycle : undefined)
  })
}

/** A key going down on `on`, the page's body unless named, bubbling to the window. */
function press(key: string | undefined, init: KeyboardEventInit = {}, on: Element = document.body) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  on.dispatchEvent(event)
  return event
}

describe('the C key', () => {
  it('cycles the center once per press, c or C, Shift let through, the key taken', () => {
    listen()
    expect(press('c').defaultPrevented).toBe(true)
    press('C', { shiftKey: true })
    expect(onCycle).toHaveBeenCalledTimes(2)
  })

  it('does nothing on a repeat, another key, or with ⌘, Ctrl or Alt', () => {
    listen()
    press('c', { repeat: true })
    press('x')
    press('c', { metaKey: true })
    press('c', { ctrlKey: true })
    press('c', { altKey: true })
    expect(onCycle).not.toHaveBeenCalled()
  })

  it('leaves a key another listener took, and one composing a character', () => {
    listen()
    const taking = (event: Event) => {
      event.preventDefault()
    }
    document.body.addEventListener('keydown', taking)
    press('c')
    document.body.removeEventListener('keydown', taking)
    press('c', { isComposing: true })
    expect(onCycle).not.toHaveBeenCalled()
  })

  it('is typed in a field, and belongs to a menu or a dialog, rather than the canvas', () => {
    listen()
    const held = ['input', 'textarea', 'select'].map((tag) => document.createElement(tag))
    const editable = document.createElement('div')
    editable.setAttribute('contenteditable', 'true')
    const menu = document.createElement('div')
    menu.setAttribute('role', 'menu')
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    const inDialog = document.createElement('button')
    dialog.append(inDialog)
    document.body.append(...held, editable, menu, dialog)
    for (const on of [...held, editable, menu, inDialog]) press('c', {}, on)
    expect(onCycle).not.toHaveBeenCalled()
  })

  it('does nothing while the canvas is inert, the one a journey leaves behind', () => {
    const left = document.createElement('div')
    left.setAttribute('inert', '')
    left.append(canvas)
    document.body.append(left)
    listen()
    press('c')
    expect(onCycle).not.toHaveBeenCalled()
  })

  it('throws nothing on an autofill’s keydown, which carries no key', () => {
    listen()
    expect(() => press(undefined)).not.toThrow()
    expect(onCycle).not.toHaveBeenCalled()
  })

  it('leaves the key alone without anything to cycle, and once unmounted', () => {
    listen({ listening: false })
    expect(press('c').defaultPrevented).toBe(false)
    const { unmount } = listen()
    unmount()
    press('c')
    expect(onCycle).not.toHaveBeenCalled()
  })
})
