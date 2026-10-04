import { describe, expect, it } from 'vitest'

import {
  centerOf,
  decodeViewState,
  defaultState,
  encodeViewState,
  followRename,
  outerKindOf,
  touches,
  withCenter,
  type ViewState,
} from './view-state.ts'

const centered = (center: string): ViewState => ({ ...defaultState, center })

describe('decodeViewState', () => {
  it('reads an empty file as the defaults', () => {
    expect(decodeViewState('')).toEqual({ state: defaultState, problems: [] })
    expect(decodeViewState(' \n')).toEqual({ state: defaultState, problems: [] })
  })

  it('reads the center and the outer expansion', () => {
    const text = '{"center": "4-software-engineering", "expansions": {"outer": "leaves"}}'
    expect(decodeViewState(text)).toEqual({
      state: { center: '4-software-engineering', expansions: { outer: 'leaves' } },
      problems: [],
    })
  })

  it('gives each missing field its default', () => {
    expect(decodeViewState('{}')).toEqual({ state: defaultState, problems: [] })
    expect(decodeViewState('{"expansions": {}}')).toEqual({ state: defaultState, problems: [] })
  })

  it('falls back to the defaults when the file is not JSON', () => {
    expect(decodeViewState('{"center": ')).toEqual({
      state: defaultState,
      problems: ['it is not JSON'],
    })
  })

  it('falls back to the defaults when the JSON is no object', () => {
    for (const text of ['[]', '"diplow"', 'null', '6']) {
      expect(decodeViewState(text)).toEqual({
        state: defaultState,
        problems: ['it holds no JSON object'],
      })
    }
  })

  it('keeps the fields that are well formed and names the others', () => {
    expect(decodeViewState('{"center": 3, "expansions": {"outer": "leaves"}}')).toEqual({
      state: { expansions: { outer: 'leaves' } },
      problems: ['`center` is not a path'],
    })
    expect(decodeViewState('{"center": "3-games", "expansions": {"outer": "context"}}')).toEqual({
      state: { center: '3-games', expansions: defaultState.expansions },
      problems: ['`expansions.outer` is none of children, branches, leaves'],
    })
    expect(decodeViewState('{"expansions": ["leaves"]}')).toEqual({
      state: defaultState,
      problems: ['`expansions` is not an object'],
    })
  })

  it('never repeats the text of the file in a problem', () => {
    const { problems } = decodeViewState('{"center": {"secret": "hunter2"}}')
    expect(problems.join(' ')).not.toContain('hunter2')
  })

  it('reads back what encodeViewState writes', () => {
    const state: ViewState = { center: '3-games/1-riftbound', expansions: { outer: 'branches' } }
    expect(decodeViewState(encodeViewState(state))).toEqual({ state, problems: [] })
    expect(decodeViewState(encodeViewState(defaultState))).toEqual({
      state: defaultState,
      problems: [],
    })
  })
})

describe('centerOf', () => {
  it("shows the file's own folder when the state names no center", () => {
    expect(centerOf(defaultState, '3-games')).toEqual({ folder: '3-games' })
  })

  it('shows the center, its path folded', () => {
    expect(centerOf(centered('./3-games//1-riftbound/'), '')).toEqual({
      folder: '3-games/1-riftbound',
    })
    expect(centerOf(centered('3-games/../6-politics'), '')).toEqual({ folder: '6-politics' })
    expect(centerOf(centered('.'), '3-games')).toEqual({ folder: '' })
  })

  it("drops a center that leaves the vault, for the file's own folder", () => {
    expect(centerOf(centered('../elsewhere'), '3-games')).toEqual({
      folder: '3-games',
      dropped: 'it leads out of the vault',
    })
    expect(centerOf(centered('3-games/../../elsewhere'), '')).toEqual({
      folder: '',
      dropped: 'it leads out of the vault',
    })
    for (const absolute of ['/etc', '\\etc', 'C:/Users']) {
      expect(centerOf(centered(absolute), '')).toEqual({
        folder: '',
        dropped: 'it is an absolute path',
      })
    }
  })

  it('drops a center on a name every folder leaves out', () => {
    expect(centerOf(centered('1-hexframe/node_modules/obsidian'), '')).toEqual({
      folder: '',
      dropped: 'every folder leaves out node_modules',
    })
    expect(centerOf(centered('.git'), '')).toEqual({
      folder: '',
      dropped: 'every folder leaves out .git',
    })
  })
})

describe('outerKindOf', () => {
  it("shows the state's kind when the folder offers it", () => {
    const state: ViewState = { expansions: { outer: 'leaves' } }
    expect(outerKindOf(state, ['branches', 'leaves', 'context'])).toBe('leaves')
  })

  it('shows Branches in place of Children past six Branches and Leaves', () => {
    expect(outerKindOf(defaultState, ['branches', 'leaves', 'context'])).toBe('branches')
  })

  it('shows Children in place of Branches or Leaves when they fit together', () => {
    expect(outerKindOf({ expansions: { outer: 'branches' } }, ['children', 'context'])).toBe(
      'children',
    )
    expect(outerKindOf({ expansions: { outer: 'leaves' } }, ['children', 'context'])).toBe(
      'children',
    )
  })
})

describe('followRename', () => {
  it('follows the center when it is renamed', () => {
    expect(followRename(centered('3-games'), '3-games', '3-play')).toEqual(centered('3-play'))
  })

  it('follows the center when a folder holding it is renamed', () => {
    expect(followRename(centered('3-games/1-riftbound'), '3-games', '3-play')).toEqual(
      centered('3-play/1-riftbound'),
    )
    expect(followRename(centered('./3-games/1-riftbound'), '3-games', '3-play')).toEqual(
      centered('3-play/1-riftbound'),
    )
  })

  it('keeps the same state when the rename is elsewhere', () => {
    for (const state of [defaultState, centered('3-games-old'), centered('../out')]) {
      expect(followRename(state, '3-games', '3-play')).toBe(state)
    }
  })
})

describe('withCenter', () => {
  it('sets the center and keeps the rest of the file as written', () => {
    const text = '{"center": "3-games", "expansions": {"outer": 6}, "zoom": 2}'
    expect(JSON.parse(withCenter(text, centered('3-play')))).toEqual({
      center: '3-play',
      expansions: { outer: 6 },
      zoom: 2,
    })
  })

  it('writes the whole state when the file holds no JSON object', () => {
    for (const text of ['', '[]', '{"center": ']) {
      expect(withCenter(text, centered('3-play'))).toBe(encodeViewState(centered('3-play')))
    }
  })
})

describe('touches', () => {
  it('counts the center, its entries and what lies in them', () => {
    expect(touches('3-games', '3-games')).toBe(true)
    expect(touches('3-games/notes.md', '3-games')).toBe(true)
    expect(touches('3-games/1-riftbound/CLAUDE.md', '3-games')).toBe(true)
  })

  it('counts a folder holding the center', () => {
    expect(touches('3-games', '3-games/1-riftbound')).toBe(true)
  })

  it('leaves out what lies deeper or elsewhere', () => {
    expect(touches('3-games/1-riftbound/sets/source.json', '3-games')).toBe(false)
    expect(touches('6-politics/CLAUDE.md', '3-games')).toBe(false)
    expect(touches('3-games-old/CLAUDE.md', '3-games')).toBe(false)
  })

  it('reads the vault root as a center like any other', () => {
    expect(touches('STACK.md', '')).toBe(true)
    expect(touches('3-games/CLAUDE.md', '')).toBe(true)
    expect(touches('3-games/1-riftbound/CLAUDE.md', '')).toBe(false)
  })
})
