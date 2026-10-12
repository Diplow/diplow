// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { linkTo } from '#/domains/assistant/entities'
import { publish } from '#/front/features/bus'
import { AskedAboutTile } from '#/front/features/facts'
import { m } from '#/paraglide/messages'

import type { Mentionable } from '../composer/mention'
import { offered, type Offering } from '../composer/typing'
import { useComposerState } from './useComposerState'

// The composer on home as the user types, picks and sends, over Tiles made by hand: a `/` listing the
// commands home offers, the language listing the languages, an `@` the Tiles, a pick putting its row
// in the field, and what a Message sent is, a command run or words with each link by its Tile's id.
// How the `@` finds and inserts is `../composer/mention.test.ts`; what the commands list is ui's
// `commands.test.ts`. And a Tile named from outside, at the caret or first, and where the next Turn
// works, the canvas centered on a Tile.

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
})

const tiles: ReadonlyArray<Mentionable> = [
  { id: 'root', title: 'Ada', trail: [] },
  { id: 'work', title: 'Work', trail: ['Ada'] },
  { id: 'team', title: 'Team', trail: ['Ada', 'Work'] },
  { id: 'lead', title: 'Team lead', trail: ['Ada'] },
]

function render(offering: Offering = { modes: true, undoable: true }, center?: string) {
  const among = offered(offering)
  const field = { current: document.createElement('textarea') }
  document.body.append(field.current)
  const { result } = renderHook(() => useComposerState(tiles, among, { center, field }))
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
  const name = (tile: string, where: Parameters<typeof result.current.actions.name>[1]) => {
    let named: ReturnType<typeof result.current.actions.name>
    act(() => {
      named = result.current.actions.name(tile, where)
    })
    return named
  }
  return { result, type, rows, pick, send, name, field }
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

  it('offers Help and the Keys where the page opens them, and not elsewhere', () => {
    const { type, rows } = render({ modes: false, undoable: false, help: true, keys: true })
    type('/')
    expect(rows()).toEqual(['language', 'keys', 'help'])
    const bare = render({ modes: false, undoable: false })
    bare.type('/')
    expect(bare.rows()).toEqual(['language'])
  })

  it('opens Help on the words after `/help`, which go to no agent, and the Keys on `/keys`', () => {
    const { type, send } = render({ modes: true, undoable: true, help: true, keys: true })
    type(`/${m.composer_command_help()} tiles and children`)
    expect(send()).toEqual({ help: 'tiles and children' })
    type(`/${m.composer_command_help()}`)
    expect(send()).toEqual({ help: '' })
    type(`/${m.composer_command_keys()}`)
    expect(send()).toEqual({ command: 'keys' })
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

  it('marks a link another starts with once, the longer whole', () => {
    const { result, type, pick } = render()
    type('@te')
    pick('lead')
    type('@Team lead @te')
    pick('team')
    type('@Team lead @Team')
    expect(result.current.state.marks).toEqual([
      { from: 0, to: 10, kind: 'tile' },
      { from: 11, to: 16, kind: 'tile' },
    ])
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

describe('a Tile named from outside', () => {
  it('is named at the caret, as a drop names it, and sent by its id', () => {
    const { result, type, name, send } = render()
    type('Look at  please', 8)
    expect(name('work', 'caret')).toEqual({
      value: 'Look at @Work please',
      caret: 14,
      link: { id: 'work', shown: '@Work' },
    })
    expect(result.current.state.value).toBe('Look at @Work please')
    expect(send()).toEqual({ message: `Look at ${linkTo('work')} please` })
  })

  it('is named first, what was written kept, as a menu asks the agent about it', () => {
    const { name, type, send } = render()
    type('what is missing?')
    expect(name('team', { first: true, then: '' })).toMatchObject({
      value: '@Team what is missing?',
      caret: 6,
    })
    expect(send()).toEqual({ message: `${linkTo('team')} what is missing?` })
  })

  it('opens with the words its caller gives after it, and keeps one link, named again', () => {
    const { result, name, send } = render()
    name('work', { first: true, then: 'a new tile, east: ' })
    expect(result.current.state.value).toBe('@Work a new tile, east: ')
    name('work', { first: true, then: '' })
    expect(result.current.state.value).toBe('@Work a new tile, east: ')
    expect(send()).toEqual({ message: `${linkTo('work')} a new tile, east:` })
  })

  it('tells a Tile apart from another of its Title already named, and names none it lacks', () => {
    const twins: ReadonlyArray<Mentionable> = [
      { id: 'a', title: 'Notes', trail: ['Ada'] },
      { id: 'b', title: 'Notes', trail: ['Ada', 'Work'] },
    ]
    const { result } = renderHook(() => useComposerState(twins, []))
    const name = (tile: string) => {
      let named: ReturnType<typeof result.current.actions.name>
      act(() => {
        named = result.current.actions.name(tile, 'caret')
      })
      return named
    }
    name('a')
    expect(name('b')).toMatchObject({ link: { id: 'b', shown: '@Work / Notes' } })
    expect(name('gone')).toBeUndefined()
  })
})

describe('a menu asking the agent', () => {
  it('names its Tile first in the field, the caret after it and the focus there', () => {
    const { result, type, field } = render()
    type('what next?')
    act(() => {
      publish(new AskedAboutTile({ tile: 'work' }))
    })
    expect(result.current.state.value).toBe('@Work what next?')
    expect(field.current.value).toBe('@Work what next?')
    expect(field.current.selectionStart).toBe(6)
    expect(document.activeElement).toBe(field.current)
  })

  it("names a free slot's Tile, then the place a new one would take", () => {
    const { result } = render()
    act(() => {
      publish(new AskedAboutTile({ tile: 'root', place: 3 }))
    })
    expect(result.current.state.value).toBe(
      `@Ada ${m.crossing_ask_for_one({ direction: m.direction_east() })}`,
    )
  })
})

describe('where the next Turn works', () => {
  it('is the centered Tile, until the Message opens with a link to another', () => {
    const { result, type, pick } = render({ modes: true, undoable: true }, 'work')
    expect(result.current.state.workingIn).toEqual({ title: 'Work', first: false })
    type('@Te')
    pick('team')
    expect(result.current.state.workingIn).toEqual({ title: 'Team', first: true })
    type('see @Team')
    expect(result.current.state.workingIn).toEqual({ title: 'Work', first: false })
  })

  it('is read off what the field sends: the words after a command, none for a command alone', () => {
    const { result, type, pick } = render({ modes: true, undoable: true }, 'work')
    type('/apply ')
    expect(result.current.state.workingIn).toBeUndefined()
    type('/apply @Te')
    pick('team')
    expect(result.current.state.workingIn).toEqual({ title: 'Team', first: true })
    type('/language ')
    expect(result.current.state.workingIn).toBeUndefined()
  })

  it('is none for `/help`, whose words find a topic and go to no Turn', () => {
    const offering = { modes: true, undoable: true, help: true }
    const { result, type } = render(offering, 'work')
    type(`/${m.composer_command_help()} tiles`)
    expect(result.current.state.workingIn).toBeUndefined()
  })

  it('is none while the page says no center', () => {
    const { result } = render()
    expect(result.current.state.workingIn).toBeUndefined()
  })
})
