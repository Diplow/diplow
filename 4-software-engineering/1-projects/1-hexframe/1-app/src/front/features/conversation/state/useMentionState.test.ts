// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { linkTo } from '#/domains/assistant/entities'

import type { Mentionable } from '../composer/mention'
import { useMentionState } from './useMentionState'

// The composer's `@` as the user types and presses keys, over Tiles made by hand: the search opening
// at an `@`, the arrows moving the active Tile, Enter, Tab or a click picking it, Escape closing it,
// and the Message sent with each link picked by its Tile's id. How a search finds and inserts is
// `../composer/mention.test.ts`.

afterEach(cleanup)

const tiles: ReadonlyArray<Mentionable> = [
  { id: 'root', title: 'Ada', trail: [] },
  { id: 'work', title: 'Work', trail: ['Ada'] },
  { id: 'team', title: 'Team', trail: ['Ada', 'Work'] },
  { id: 'tea', title: 'Tea time', trail: ['Ada'] },
]

function render() {
  const { result } = renderHook(() => useMentionState(tiles))
  /** The user typed `value`, the caret at its end unless told. */
  const type = (value: string, caret = value.length) => {
    act(() => {
      result.current.actions.typed(value, caret)
    })
  }
  const key = (name: string, value: string) => {
    let answered: ReturnType<typeof result.current.actions.key> | undefined
    act(() => {
      answered = result.current.actions.key(name, value)
    })
    return answered
  }
  const offered = () => result.current.state.offered.map(({ id }) => id)
  return { result, type, key, offered }
}

describe("the composer's @", () => {
  it('opens a search at an `@`, offering the Tiles whose Title holds what follows', () => {
    const { result, type, offered } = render()
    type('Ask ')
    expect(result.current.state.open).toBe(false)
    type('Ask @')
    expect(result.current.state.open).toBe(true)
    expect(offered()).toEqual(['root', 'work', 'team', 'tea'])
    type('Ask @te')
    expect(offered()).toEqual(['team', 'tea'])
    expect(result.current.state.active?.id).toBe('team')
  })

  it('closes once nothing matches, or the caret leaves the search', () => {
    const { result, type } = render()
    type('Ask @zz')
    expect(result.current.state.open).toBe(false)
    type('Ask @te now', 3)
    expect(result.current.state.open).toBe(false)
    expect(result.current.state.active).toBeUndefined()
  })

  it('moves the active Tile with the arrows, around the ends', () => {
    const { result, type, key } = render()
    type('@te')
    expect(key('ArrowDown', '@te')).toEqual({ taken: true })
    expect(result.current.state.active?.id).toBe('tea')
    key('ArrowDown', '@te')
    expect(result.current.state.active?.id).toBe('team')
    key('ArrowUp', '@te')
    expect(result.current.state.active?.id).toBe('tea')
    type('@tea')
    expect(result.current.state.active?.id).toBe('team')
  })

  it('picks the active Tile on Enter, its link shown in the input, the caret after it', () => {
    const { result, type, key } = render()
    type('Ask @wo')
    expect(key('Enter', 'Ask @wo')).toEqual({
      taken: true,
      edited: { value: 'Ask @Work ', caret: 10 },
    })
    expect(result.current.state.open).toBe(false)
    // The link picked opens no search of its own as the user writes on.
    type('Ask @Work ')
    expect(result.current.state.open).toBe(false)
  })

  it('picks on Tab, and a Tile clicked, as on Enter', () => {
    const { result, type, key } = render()
    type('@te')
    expect(key('Tab', '@te')?.edited).toEqual({ value: '@Team ', caret: 6 })
    type('@Team and @')
    let clicked: unknown
    act(() => {
      clicked = result.current.actions.pick('@Team and @', tiles[3] as Mentionable)
    })
    expect(clicked).toEqual({ value: '@Team and @Tea time ', caret: 20 })
  })

  it('closes the search on Escape until another `@`', () => {
    const { result, type, key } = render()
    type('Ask @te')
    expect(key('Escape', 'Ask @te')).toEqual({ taken: true })
    expect(result.current.state.open).toBe(false)
    type('Ask @tea')
    expect(result.current.state.open).toBe(false)
    type('Ask @tea and @')
    expect(result.current.state.open).toBe(true)
    act(() => {
      result.current.actions.close()
    })
    expect(result.current.state.open).toBe(false)
  })

  it('leaves every key to the input while no search is open', () => {
    const { key, type } = render()
    expect(key('Enter', 'Hello')).toEqual({ taken: false })
    type('@')
    expect(key('a', '@')).toEqual({ taken: false })
  })

  it('sends the Message with each link picked by its Tile’s id, then forgets them', () => {
    const { result, type, key } = render()
    type('@wo')
    key('Enter', '@wo')
    type('@Work and @tea t')
    key('Enter', '@Work and @tea t')
    let sent = ''
    act(() => {
      sent = result.current.actions.sent('@Work and @Tea time, not @Workshop')
    })
    expect(sent).toBe(`${linkTo('work')} and ${linkTo('tea')}, not @Workshop`)
    act(() => {
      sent = result.current.actions.sent('@Work again')
    })
    expect(sent).toBe('@Work again')
  })

  it('picks nothing while no search is under way', () => {
    const { result } = render()
    let picked: unknown = 'not yet'
    act(() => {
      picked = result.current.actions.pick('Hello', tiles[0] as Mentionable)
    })
    expect(picked).toBeUndefined()
  })
})
