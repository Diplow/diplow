// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { linkTo } from '#/domains/assistant/entities'
import { m } from '#/paraglide/messages'

import type { Mentionable } from '../composer/mention'
import { offered } from '../composer/typing'
import { useComposerState } from './useComposerState'

// The composer on home as the user types, picks and sends, over Tiles made by hand: a `/` listing the
// commands home offers, the language listing the languages, an `@` the Tiles, a pick putting its row
// in the field, and what a Message sent is, a command run or words with each link by its Tile's id.
// How the `@` finds and inserts is `../composer/mention.test.ts`; what the commands list is ui's
// `commands.test.ts`.

afterEach(cleanup)

const tiles: ReadonlyArray<Mentionable> = [
  { id: 'root', title: 'Ada', trail: [] },
  { id: 'work', title: 'Work', trail: ['Ada'] },
  { id: 'team', title: 'Team', trail: ['Ada', 'Work'] },
]

function render(offering = { modes: true, undoable: true }) {
  const among = offered(offering)
  const { result } = renderHook(() => useComposerState(tiles, among))
  /** The user typed `value`, the caret at its end unless told. */
  const type = (value: string, caret = value.length) => {
    act(() => {
      result.current.actions.change(value, caret)
    })
  }
  const rows = () =>
    result.current.state.typing?.listing.groups.flatMap((group) => group.rows.map(({ id }) => id))
  const pick = (row: string) => {
    let picked: ReturnType<typeof result.current.actions.pick>
    act(() => {
      picked = result.current.actions.pick(row)
    })
    return picked
  }
  const send = () => {
    let submitted: ReturnType<typeof result.current.actions.submit>
    act(() => {
      submitted = result.current.actions.submit()
    })
    return submitted
  }
  return { result, type, rows, pick, send }
}

describe("the composer's commands", () => {
  it('lists the commands home offers at a `/` opening the field, and none elsewhere', () => {
    const { result, type, rows } = render()
    type('/')
    expect(result.current.state.typing?.kind).toBe('command')
    expect(rows()).toEqual(['ask', 'apply', 'undo', 'language'])
    type('/a')
    expect(rows()).toEqual(['ask', 'apply'])
    type('so /a')
    expect(result.current.state.typing).toBeUndefined()
  })

  it('offers the Mode only while it is shown, and undo only while something may be undone', () => {
    const { type, rows } = render({ modes: false, undoable: false })
    type('/')
    expect(rows()).toEqual(['language'])
  })

  it('puts a command picked in the field, marked, and runs it once sent, the field emptied', () => {
    const { result, type, pick, send } = render()
    type('/ap')
    expect(pick('apply')).toEqual({ value: `/${m.composer_command_apply()} `, caret: 7 })
    expect(result.current.state.value).toBe('/apply ')
    expect(result.current.state.typing).toBeUndefined()
    expect(result.current.state.marks).toEqual([{ from: 0, to: 6, kind: 'command' }])
    expect(send()).toEqual({ command: 'apply' })
    expect(result.current.state.value).toBe('')
  })

  it('sends the words after a command once it ran, as a Message', () => {
    const { pick, type, send } = render()
    type('/ask what is in @wo')
    pick('work')
    expect(send()).toEqual({ command: 'ask', then: `what is in ${linkTo('work')}` })
  })

  it('keeps the field when the language names none hexframe is in', () => {
    const { result, type, send } = render()
    type('/language klingon')
    expect(send()).toBeUndefined()
    expect(result.current.state.value).toBe('/language klingon')
  })

  it('lists the languages after the language, and goes to the one picked', () => {
    const { type, rows, pick } = render()
    type(`/${m.composer_command_language()} `)
    expect(rows()).toEqual(['en', 'fr'])
    type(`/${m.composer_command_language()} fr`)
    expect(rows()).toEqual(['fr'])
    expect(pick('fr')).toEqual({ language: 'fr' })
  })

  it('answers the language to its name in every language', () => {
    const { type, rows, send } = render()
    type('/langue ')
    expect(rows()).toEqual(['en', 'fr'])
    type('/langue fr')
    expect(send()).toEqual({ language: 'fr' })
  })

  it('sends a `/` no command offered answers as words', () => {
    const { type, rows, send } = render({ modes: false, undoable: false })
    type('/undo')
    expect(rows()).toEqual([])
    expect(send()).toEqual({ message: '/undo' })
  })

  it('leaves the list on Escape until the field changes', () => {
    const { result, type } = render()
    type('/')
    act(() => {
      result.current.actions.leave()
    })
    expect(result.current.state.typing).toBeUndefined()
    type('/a')
    expect(result.current.state.typing?.kind).toBe('command')
  })
})

describe("the composer's @", () => {
  it('lists the Tiles at an `@`, each with the Titles above it', () => {
    const { result, type, rows } = render()
    type('Ask @w')
    expect(result.current.state.typing?.kind).toBe('tile')
    expect(rows()).toEqual(['work'])
    expect(result.current.state.typing?.listing.groups[0]?.rows[0]).toMatchObject({ path: 'Ada' })
  })

  it('puts a Tile picked in the field, marked, opening no search of its own, and sends it by its id', () => {
    const { result, type, pick, send } = render()
    type('Ask @te')
    expect(pick('team')).toEqual({
      value: 'Ask @Team ',
      caret: 10,
      link: { id: 'team', shown: '@Team' },
    })
    expect(result.current.state.marks).toEqual([{ from: 4, to: 9, kind: 'tile' }])
    type('Ask @Team', 9)
    expect(result.current.state.typing).toBeUndefined()
    type('Ask @Team about it ')
    expect(send()).toEqual({ message: `Ask ${linkTo('team')} about it` })
  })

  it('marks nothing once a link picked is edited, and sends it as written', () => {
    const { result, type, pick, send } = render()
    type('@wo')
    pick('work')
    type('@Workshop')
    expect(result.current.state.marks).toEqual([])
    expect(send()).toEqual({ message: '@Workshop' })
  })
})
