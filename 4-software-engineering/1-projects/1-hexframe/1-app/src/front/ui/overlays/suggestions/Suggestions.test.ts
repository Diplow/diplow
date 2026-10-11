// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Suggestions } from './Suggestions'

// The list over its field, as the Composer lays it out: a click in the field leaves it open, a click
// away closes it.

afterEach(cleanup)

/** A click of the mouse on `target`: its press, then the click, as the browser sends them. */
const click = (target: Element) => {
  target.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }),
  )
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }))
}

/** The list open over a textarea, wrapped as the Composer wraps it, and a button away from both. */
async function opened() {
  const onClose = vi.fn<() => void>()
  render(
    createElement(
      'div',
      null,
      createElement(Suggestions, {
        id: 'mentions',
        label: 'Tiles',
        open: true,
        suggestions: [{ id: 'work', label: 'Work' }],
        active: 'work',
        onPick: () => undefined,
        onClose,
        children: createElement(
          'div',
          null,
          createElement('textarea', { 'aria-label': 'Message' }),
        ),
      }),
      createElement('button', { type: 'button' }, 'Elsewhere'),
    ),
  )
  // The list starts listening for a click away once it opened, on the next tick.
  await new Promise((resolve) => setTimeout(resolve, 0))
  return onClose
}

describe('the suggestions', () => {
  it('stay open on a click in their field, the search going on', async () => {
    const onClose = await opened()
    click(screen.getByRole('textbox', { name: 'Message' }))
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('listbox', { name: 'Tiles' })).toBeDefined()
  })

  it('close on a click away from the list and its field', async () => {
    const onClose = await opened()
    click(screen.getByRole('button', { name: 'Elsewhere' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
