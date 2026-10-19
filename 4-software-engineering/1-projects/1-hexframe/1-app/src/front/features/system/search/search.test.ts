import { describe, expect, it } from 'vitest'

import type { TileNode } from '#/front/ui/canvas/view/tiles'

import { tileLink } from '#/api/mapping/files/download'

import {
  afterDelete,
  changeOf,
  keyOf,
  opensWidget,
  readSystemSearch,
  viewOf,
  withChange,
  withoutTile,
  withView,
} from './search'

describe('readSystemSearch', () => {
  it('centers on the Tile an export links a left-out Reference to', () => {
    const id = crypto.randomUUID()
    const link = new URL(tileLink('https://hexframe.test/_serverFn/x')(id))
    expect(link.pathname).toBe('/')
    expect(viewOf(readSystemSearch(Object.fromEntries(link.searchParams))).center).toBe(id)
  })

  it('reads the view and the change, every field set', () => {
    expect(readSystemSearch({ center: 'a', inner: 'context', add: 'a', slot: -2 })).toEqual({
      center: 'a',
      frame: undefined,
      inner: 'context',
      expanded: undefined,
      add: 'a',
      slot: -2,
      import: undefined,
      edit: undefined,
      share: undefined,
      move: undefined,
    })
  })

  it('falls back field by field on what the URL got wrong', () => {
    const search = readSystemSearch({ center: 'a', slot: 7, edit: '', move: 42 })
    expect(search).toMatchObject({ center: 'a', slot: undefined, edit: undefined })
    expect(search.move).toBeUndefined()
  })
})

describe('changeOf', () => {
  const read = (search: Record<string, unknown>) => changeOf(readSystemSearch(search))

  it('reads each change', () => {
    expect(read({})).toEqual({ kind: 'none' })
    expect(read({ add: 'a', slot: 3 })).toEqual({ kind: 'add', parent: 'a', slot: 3 })
    expect(read({ edit: 'a' })).toEqual({ kind: 'edit', id: 'a' })
    expect(read({ share: 'a' })).toEqual({ kind: 'share', id: 'a' })
    expect(read({ move: 'a' })).toEqual({ kind: 'move', id: 'a' })
    expect(read({ import: 'a', slot: { leaf: 2 } })).toEqual({
      kind: 'import',
      place: { _tag: 'Slot', parent: 'a', slot: { leaf: 2 } },
    })
    expect(read({ import: 'root' })).toEqual({ kind: 'import', place: { _tag: 'Root' } })
  })

  it('opens no new Tile form, nor an import under a Tile, without its slot', () => {
    expect(read({ add: 'a' })).toEqual({ kind: 'none' })
    expect(read({ import: 'a' })).toEqual({ kind: 'none' })
  })

  it('lets a form win over a move, since the form covers the canvas', () => {
    expect(read({ move: 'a', edit: 'b' })).toEqual({ kind: 'edit', id: 'b' })
    expect(read({ move: 'a', add: 'b', slot: 1 })).toMatchObject({ kind: 'add' })
    expect(read({ move: 'a', import: 'root' })).toMatchObject({ kind: 'import' })
  })

  it('lets a form win over who may see a Tile, and both over a move', () => {
    expect(read({ share: 'a', edit: 'b' })).toEqual({ kind: 'edit', id: 'b' })
    expect(read({ move: 'a', share: 'b' })).toEqual({ kind: 'share', id: 'b' })
  })
  it("reads an Organization's members and an Organization being made, after who may see a Tile", () => {
    expect(read({ members: 'a' })).toEqual({ kind: 'members', id: 'a' })
    expect(read({ organization: true })).toEqual({ kind: 'organization' })
    expect(read({ organization: 'yes' })).toEqual({ kind: 'none' })
    expect(read({ members: 'a', share: 'b' })).toEqual({ kind: 'share', id: 'b' })
    expect(read({ members: 'a', organization: true })).toEqual({ kind: 'members', id: 'a' })
    expect(read({ move: 'a', organization: true })).toEqual({ kind: 'organization' })
  })

  it('writes each back as the one change under way', () => {
    const members = withChange(readSystemSearch({ share: 'b' }), { kind: 'members', id: 'a' })
    expect(members).toMatchObject({ members: 'a', share: undefined, organization: undefined })
    const made = withChange(members, { kind: 'organization' })
    expect(made).toMatchObject({ organization: true, members: undefined })
    expect(changeOf(withChange(made, { kind: 'none' }))).toEqual({ kind: 'none' })
  })
})

describe('withView and withChange', () => {
  const search = readSystemSearch({ center: 'a', expanded: { 2: 'children' }, move: 'c' })

  it('changes the view and keeps the change under way', () => {
    const next = withView(search, { inner: 'context' })
    expect(viewOf(next)).toEqual({
      center: undefined,
      frame: undefined,
      inner: 'context',
      expanded: undefined,
    })
    expect(changeOf(next)).toEqual({ kind: 'move', id: 'c' })
  })

  it('changes the change and keeps the view', () => {
    const next = withChange(search, { kind: 'add', parent: 'a', slot: -4 })
    expect(viewOf(next)).toEqual(viewOf(search))
    expect(changeOf(next)).toEqual({ kind: 'add', parent: 'a', slot: -4 })
    expect(next.move).toBeUndefined()
  })

  it('turns a new Tile into an import in the same slot, and back, and an import into the Root', () => {
    const adding = withChange(search, { kind: 'add', parent: 'a', slot: 2 })
    const place = { _tag: 'Slot', parent: 'a', slot: 2 } as const
    const importing = withChange(adding, { kind: 'import', place })
    expect(importing).toMatchObject({ import: 'a', slot: 2, add: undefined })
    expect(changeOf(importing)).toEqual({ kind: 'import', place })
    expect(changeOf(withChange(importing, { kind: 'add', parent: 'a', slot: 2 }))).toEqual({
      kind: 'add',
      parent: 'a',
      slot: 2,
    })
    const vault = withChange(importing, { kind: 'import', place: { _tag: 'Root' } })
    expect(vault).toMatchObject({ import: 'root', slot: undefined })
    expect(changeOf(withChange(vault, { kind: 'none' }))).toEqual({ kind: 'none' })
  })

  it('ends the change under way', () => {
    expect(changeOf(withChange(search, { kind: 'none' }))).toEqual({ kind: 'none' })
  })
})

describe('withoutTile', () => {
  // a goes, and with it its Branch a1, its Leaf a4 and its Context Tile a2; its Reference to b
  // leaves b standing.
  const gone: TileNode = {
    id: 'a',
    title: 'A',
    preview: '',
    branches: { 1: { id: 'a1', title: 'A1', preview: '' } },
    leaves: { 4: { id: 'a4', title: 'A4', preview: '', leaf: true } },
    context: {
      2: { id: 'a2', title: 'A2', preview: '' },
      3: { id: 'b', title: 'B', preview: '', reference: { from: 'A' } },
    },
  }

  it('ends the change under way when it named the Tile gone', () => {
    for (const search of [
      { move: 'a' },
      { edit: 'a' },
      { share: 'a' },
      { add: 'a', slot: 2 },
      { import: 'a', slot: 2 },
    ]) {
      const next = withoutTile(readSystemSearch({ center: 'c', ...search }), gone)
      expect(changeOf(next)).toEqual({ kind: 'none' })
      expect(next.center).toBe('c')
    }
  })

  it('ends the change under way when it named a Tile below it, a Child or a Context Tile', () => {
    for (const search of [
      { move: 'a1' },
      { edit: 'a2' },
      { move: 'a4' },
      { add: 'a1', slot: -2 },
    ]) {
      expect(changeOf(withoutTile(readSystemSearch(search), gone))).toEqual({ kind: 'none' })
    }
  })

  it('keeps a change that named another Tile, one referenced from below included', () => {
    expect(changeOf(withoutTile(readSystemSearch({ move: 'c' }), gone))).toEqual({
      kind: 'move',
      id: 'c',
    })
    expect(changeOf(withoutTile(readSystemSearch({ move: 'b' }), gone))).toEqual({
      kind: 'move',
      id: 'b',
    })
    expect(changeOf(withoutTile(readSystemSearch({ import: 'root' }), gone))).toEqual({
      kind: 'import',
      place: { _tag: 'Root' },
    })
  })
})

describe('keyOf', () => {
  it('is the same for two changes alike, and differs for another slot, Tile or kind', () => {
    expect(keyOf({ kind: 'add', parent: 'a', slot: { leaf: 2 } })).toBe(
      keyOf({ kind: 'add', parent: 'a', slot: { leaf: 2 } }),
    )
    const others = [
      keyOf({ kind: 'add', parent: 'a', slot: 2 }),
      keyOf({ kind: 'add', parent: 'b', slot: { leaf: 2 } }),
      keyOf({ kind: 'edit', id: 'a' }),
      keyOf({ kind: 'move', id: 'a' }),
      keyOf({ kind: 'none' }),
    ]
    expect(new Set([keyOf({ kind: 'add', parent: 'a', slot: { leaf: 2 } }), ...others]).size).toBe(
      6,
    )
  })
})

describe('opensWidget', () => {
  const none = readSystemSearch({})
  const adding = withChange(none, { kind: 'add', parent: 'a', slot: 2 })

  it('opens the widget for a new Tile, an import, an edit or who may see a Tile', () => {
    expect(opensWidget(none, adding)).toBe(true)
    expect(opensWidget(none, withChange(none, { kind: 'edit', id: 'a' }))).toBe(true)
    expect(opensWidget(none, withChange(none, { kind: 'share', id: 'a' }))).toBe(true)
    expect(opensWidget(adding, withChange(adding, { kind: 'share', id: 'a' }))).toBe(true)
    expect(opensWidget(none, withChange(none, { kind: 'members', id: 'a' }))).toBe(true)
    expect(opensWidget(none, withChange(none, { kind: 'organization' }))).toBe(true)
    expect(opensWidget(none, withChange(none, { kind: 'import', place: { _tag: 'Root' } }))).toBe(
      true,
    )
  })

  it('opens another form over the one under way, but not the same one again', () => {
    expect(opensWidget(adding, withChange(none, { kind: 'add', parent: 'a', slot: 3 }))).toBe(true)
    expect(opensWidget(adding, withView(adding, { center: 'b' }))).toBe(false)
  })

  it('opens none for a move, an end, or a change made later from the URL of its moment', () => {
    expect(opensWidget(none, withChange(none, { kind: 'move', id: 'a' }))).toBe(false)
    expect(opensWidget(adding, withChange(adding, { kind: 'none' }))).toBe(false)
    expect(opensWidget(none, (current) => withChange(current, { kind: 'edit', id: 'a' }))).toBe(
      false,
    )
  })
})

describe('afterDelete', () => {
  const gone: TileNode = {
    id: 'a',
    title: 'A',
    preview: '',
    branches: { 1: { id: 'a1', title: 'A1', preview: '' } },
  }
  const tree: TileNode = {
    id: 'root',
    title: 'Root',
    preview: '',
    branches: {
      2: { id: 'p', title: 'P', preview: '', branches: { 3: gone } },
      5: { id: 'q', title: 'Q', preview: '' },
    },
  }
  const deleted = afterDelete(tree, 'p', gone)

  it('centers the page on the Tile the deleted one stood under', () => {
    expect(viewOf(deleted(readSystemSearch({ center: 'a' }))).center).toBe('p')
  })

  it('ends a change that named the Tile gone or one below it', () => {
    for (const search of [{ edit: 'a' }, { move: 'a1' }, { add: 'a1', slot: 2 }]) {
      expect(changeOf(deleted(readSystemSearch({ center: 'a', ...search })))).toEqual({
        kind: 'none',
      })
    }
  })

  it('keeps any other change under way', () => {
    expect(changeOf(deleted(readSystemSearch({ center: 'a', edit: 'q' })))).toEqual({
      kind: 'edit',
      id: 'q',
    })
  })
})
