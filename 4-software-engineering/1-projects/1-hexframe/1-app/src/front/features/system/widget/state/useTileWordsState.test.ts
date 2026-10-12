// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { type Refilled, useTileWordsState } from './useTileWordsState'

// What the user writes in a tile widget: the words it opens on, a change kept, a refusal put back with
// what the user typed, cleared from each field as it changes, and a later refusal putting its words
// back over what the widget held.

afterEach(cleanup)

const read = { title: 'Work', preview: 'What I do', body: '# Work' }

function render(refilled?: Refilled) {
  const { result, rerender } = renderHook(
    ({ refill }: { refill: Refilled | undefined }) => useTileWordsState(read, refill),
    { initialProps: { refill: refilled } },
  )
  return {
    result,
    refill: (refill: Refilled | undefined) => {
      rerender({ refill })
    },
    change: (words: typeof read) => {
      act(() => {
        result.current.actions.change(words)
      })
    },
  }
}

describe('the words of a tile widget', () => {
  it('open on the Tile, unrefused, and keep what the user writes', () => {
    const { result, change } = render()
    expect(result.current.state).toEqual({ words: read, refused: undefined })
    change({ ...read, title: 'Job' })
    expect(result.current.state.words).toEqual({ ...read, title: 'Job' })
  })

  it('open on what a refusal put back, the refusal on its field', () => {
    const typed = { ...read, title: '' }
    const { result } = render({ turn: 1, words: typed, refused: { title: 'Name it.' } })
    expect(result.current.state).toEqual({ words: typed, refused: { title: 'Name it.' } })
  })

  it('clear a refusal from the field the user changes, and keep it on the others', () => {
    const { result, change } = render({
      turn: 1,
      words: read,
      refused: { title: 'Name it.', preview: 'Too long.' },
    })
    change({ ...read, preview: 'Shorter' })
    expect(result.current.state.refused).toEqual({ title: 'Name it.' })
  })

  it('take a later refusal over what the widget held, and the same one only once', () => {
    const { result, refill, change } = render()
    change({ ...read, title: 'Mine' })
    const typed = { ...read, title: 'Taken' }
    refill({ turn: 2, words: typed, refused: { title: 'Taken meanwhile.' } })
    expect(result.current.state).toEqual({ words: typed, refused: { title: 'Taken meanwhile.' } })
    change({ ...typed, body: 'More' })
    refill({ turn: 2, words: typed, refused: { title: 'Taken meanwhile.' } })
    expect(result.current.state.words).toEqual({ ...typed, body: 'More' })
  })
})
