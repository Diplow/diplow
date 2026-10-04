import { describe, expect, it } from 'vitest'

import {
  centerOf,
  decodeViewState,
  defaultState,
  encodeViewState,
  followRename,
  touches,
  withChanges,
  type ViewState,
} from './view-state.ts'

const centered = (center: string): ViewState => ({ ...defaultState, center })

describe('decodeViewState', () => {
  it('reads an empty file as the defaults', () => {
    expect(decodeViewState('')).toEqual({ state: defaultState, problems: [] })
    expect(decodeViewState(' \n')).toEqual({ state: defaultState, problems: [] })
  })

  it('reads the center and the expansions', () => {
    const text =
      '{"center": "4-software-engineering", ' +
      '"expansions": {"outer": "branches", "inner": "leaves", "branches": {"3": "context"}}}'
    expect(decodeViewState(text)).toEqual({
      state: {
        center: '4-software-engineering',
        expansions: { outer: 'branches', inner: 'leaves', branches: { 3: 'context' } },
      },
      problems: [],
    })
  })

  it('reads a peeled center and a collapsed one', () => {
    expect(decodeViewState('{"expansions": {"outer": null, "inner": "leaves"}}').state).toEqual({
      expansions: { outer: null, inner: 'leaves', branches: {} },
    })
    expect(decodeViewState('{"expansions": {"outer": null, "inner": null}}').state).toEqual({
      expansions: { outer: null, inner: null, branches: {} },
    })
  })

  it('gives a missing kind the default that can sit beside the other one', () => {
    const expansionsOf = (json: string) => decodeViewState(json).state.expansions
    expect(expansionsOf('{"expansions": {"outer": "leaves"}}')).toEqual({
      outer: 'leaves',
      inner: 'context',
      branches: {},
    })
    expect(expansionsOf('{"expansions": {"inner": "leaves"}}')).toMatchObject({
      outer: 'branches',
      inner: 'leaves',
    })
    expect(expansionsOf('{"expansions": {"inner": null}}')).toMatchObject({
      outer: null,
      inner: null,
    })
  })

  it('keeps the outer kind and shows Context inside it when the pair is not allowed', () => {
    for (const outer of ['children', 'leaves']) {
      const text = `{"expansions": {"outer": "${outer}", "inner": "leaves"}}`
      expect(decodeViewState(text)).toEqual({
        state: { expansions: { outer, inner: 'context', branches: {} } },
        problems: [`\`expansions.inner\` can't be leaves beside ${outer}`],
      })
    }
    expect(decodeViewState('{"expansions": {"outer": "branches", "inner": null}}')).toEqual({
      state: { expansions: { outer: 'branches', inner: 'context', branches: {} } },
      problems: ["`expansions.inner` can't be null beside branches"],
    })
  })

  it('leaves closed a Branch whose direction or kind it cannot read', () => {
    const text = '{"expansions": {"branches": {"3": "leaves", "7": "leaves", "1": "rings"}}}'
    expect(decodeViewState(text)).toEqual({
      state: { expansions: { ...defaultState.expansions, branches: { 3: 'leaves' } } },
      problems: [
        "`expansions.branches` holds a direction or a kind it can't read",
        "`expansions.branches` holds a direction or a kind it can't read",
      ],
    })
    expect(decodeViewState('{"expansions": {"branches": []}}').problems).toEqual([
      '`expansions.branches` is not an object',
    ])
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
      state: { expansions: { outer: 'leaves', inner: 'context', branches: {} } },
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
    const state: ViewState = {
      center: '3-games/1-riftbound',
      expansions: { outer: 'branches', inner: 'leaves', branches: { 2: 'children' } },
    }
    expect(decodeViewState(encodeViewState(state))).toEqual({ state, problems: [] })
    const collapsed: ViewState = { expansions: { outer: null, inner: null, branches: {} } }
    expect(decodeViewState(encodeViewState(collapsed))).toEqual({ state: collapsed, problems: [] })
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
    for (const absolute of ['/etc', '\\etc', 'C:/Users', 'C:\\Users', 'C:']) {
      expect(centerOf(centered(absolute), '')).toEqual({
        folder: '',
        dropped: 'it is an absolute path',
      })
    }
  })

  it('shows a center that only starts like a Windows drive, a letter and a colon, as relative', () => {
    expect(centerOf(centered('a:notes'), '')).toEqual({ folder: 'a:notes' })
    expect(centerOf(centered('a:notes/1-x'), '')).toEqual({ folder: 'a:notes/1-x' })
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

describe('withChanges', () => {
  it('sets the center and keeps the rest of the file as written', () => {
    const text = '{"center": "3-games", "expansions": {"outer": 6}, "zoom": 2}'
    const { state } = decodeViewState(text)
    expect(JSON.parse(withChanges(text, state, { ...state, center: '3-play' }))).toEqual({
      center: '3-play',
      expansions: { outer: 6 },
      zoom: 2,
    })
  })

  it('sets the expansions when they change, and the center as it was', () => {
    const text = '{"center": "3-games", "zoom": 2}'
    const { state } = decodeViewState(text)
    const expansions = { outer: null, inner: 'context', branches: {} } as const
    expect(JSON.parse(withChanges(text, state, { ...state, expansions }))).toEqual({
      center: '3-games',
      expansions: { outer: null, inner: 'context' },
      zoom: 2,
    })
  })

  it('writes the whole state when the file holds no JSON object', () => {
    for (const text of ['', '[]', '{"center": ']) {
      expect(withChanges(text, defaultState, centered('3-play'))).toBe(
        encodeViewState(centered('3-play')),
      )
    }
  })
})

describe('touches', () => {
  it('counts the center, its entries and what lies in them', () => {
    expect(touches('3-games', ['3-games'])).toBe(true)
    expect(touches('3-games/notes.md', ['3-games'])).toBe(true)
    expect(touches('3-games/1-riftbound/CLAUDE.md', ['3-games'])).toBe(true)
  })

  it('counts a folder holding the center', () => {
    expect(touches('3-games', ['3-games/1-riftbound'])).toBe(true)
  })

  it('leaves out what lies deeper or elsewhere', () => {
    expect(touches('3-games/1-riftbound/sets/source.json', ['3-games'])).toBe(false)
    expect(touches('6-politics/CLAUDE.md', ['3-games'])).toBe(false)
    expect(touches('3-games-old/CLAUDE.md', ['3-games'])).toBe(false)
  })

  it('reads the vault root as a center like any other', () => {
    expect(touches('STACK.md', [''])).toBe(true)
    expect(touches('3-games/CLAUDE.md', [''])).toBe(true)
    expect(touches('3-games/1-riftbound/CLAUDE.md', [''])).toBe(false)
  })

  it('counts a change under any folder drawn, and none beside them', () => {
    const folders = ['3-games', '6-politics/1-x']
    expect(touches('6-politics/1-x/notes.md', folders)).toBe(true)
    expect(touches('6-politics/2-y/notes.md', folders)).toBe(false)
  })

  it('counts what lies in an opened Branch as in the center', () => {
    const folders = ['', '3-games']
    expect(touches('3-games/1-riftbound/CLAUDE.md', folders)).toBe(true)
    expect(touches('3-games/1-riftbound/sets/source.json', folders)).toBe(false)
  })
})
