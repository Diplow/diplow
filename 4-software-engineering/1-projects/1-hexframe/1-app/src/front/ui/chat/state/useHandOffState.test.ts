// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react'
import type { FocusEvent } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { useHandOffState } from './useHandOffState'

// A piece open, then decided, its focus moving as a browser moves it: inside it, out to a dialog it
// opened (outside its DOM, inside its React tree), or away for good.

afterEach(cleanup)

const decided = 'Accepted: Split Projects in two'

function render() {
  const zone = document.createElement('section')
  const button = zone.appendChild(document.createElement('button'))
  const { result, rerender } = renderHook(
    ({ standing }: { standing: 'open' | 'decided' }) => useHandOffState(standing, decided),
    { initialProps: { standing: 'open' as 'open' | 'decided' } },
  )
  const blurTo = (target: Element | null) => {
    result.current.onBlur({
      currentTarget: zone,
      relatedTarget: target,
    } as unknown as FocusEvent<HTMLElement>)
  }
  return {
    result,
    decide: () => {
      rerender({ standing: 'decided' })
    },
    reopen: () => {
      rerender({ standing: 'open' })
    },
    focus: () => {
      act(() => {
        result.current.onFocus()
      })
    },
    leaveWithin: () => {
      act(() => {
        blurTo(button)
      })
    },
    leaveForGood: () => {
      act(() => {
        blurTo(document.body)
      })
    },
    leaveForDialog: () => {
      // The dialog sits outside the zone's DOM: the blur reads as leaving, its focus as coming back.
      act(() => {
        blurTo(document.createElement('div'))
        result.current.onFocus()
      })
    },
  }
}

describe('the hand-off', () => {
  it('says nothing while it waits', () => {
    const { result } = render()
    expect(result.current).toMatchObject({ handOff: false, status: '' })
  })

  it('hands the focus to the receipt when decided from inside, and says nothing more', () => {
    const piece = render()
    piece.focus()
    piece.decide()
    expect(piece.result.current).toMatchObject({ handOff: true, status: '' })
  })

  it('keeps the focus where the user is when decided elsewhere, and says the decision', () => {
    const piece = render()
    piece.decide()
    expect(piece.result.current).toMatchObject({ handOff: false, status: decided })
  })

  it('counts the focus as inside while it moves within', () => {
    const piece = render()
    piece.focus()
    piece.leaveWithin()
    piece.decide()
    expect(piece.result.current.handOff).toBe(true)
  })

  it('counts a dialog it opened as inside it', () => {
    const piece = render()
    piece.focus()
    piece.leaveForDialog()
    piece.decide()
    expect(piece.result.current.handOff).toBe(true)
  })

  it('lets the focus go once it left for good', () => {
    const piece = render()
    piece.focus()
    piece.leaveForGood()
    piece.decide()
    expect(piece.result.current).toMatchObject({ handOff: false, status: decided })
  })

  it('starts afresh once open again, its old focus forgotten', () => {
    const piece = render()
    piece.focus()
    piece.decide()
    piece.reopen()
    expect(piece.result.current).toMatchObject({ handOff: false, status: '' })
    piece.decide()
    expect(piece.result.current).toMatchObject({ handOff: false, status: decided })
  })

  it('starts decided with nothing to hand off nor say', () => {
    const { result } = renderHook(() => useHandOffState('decided', decided))
    expect(result.current).toMatchObject({ handOff: false, status: '' })
  })
})
