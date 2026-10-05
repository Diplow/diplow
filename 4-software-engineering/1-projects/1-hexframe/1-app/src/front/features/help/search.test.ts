import { describe, expect, it } from 'vitest'

import { readHelpSearch, viewOf, withOpen, withView } from './search'

// The Help page's search params: the view, as on home, and the open Body, each field falling back on
// its own, and each change keeping the other.

describe("the Help page's search params", () => {
  it('reads the view and the open Body, a field the URL got wrong falling back alone', () => {
    expect(
      readHelpSearch({ center: 'help/3', expanded: ['help/3/1'], context: true, open: 'help/3' }),
    ).toEqual({ center: 'help/3', expanded: ['help/3/1'], context: true, open: 'help/3' })
    expect(readHelpSearch({ center: 'help/2', open: '' })).toEqual({
      center: 'help/2',
      expanded: undefined,
      context: undefined,
      open: undefined,
    })
    expect(readHelpSearch({})).toEqual({
      center: undefined,
      expanded: undefined,
      context: undefined,
      open: undefined,
    })
  })

  it('changes the view and keeps the open Body', () => {
    const search = readHelpSearch({ center: 'help/2', open: 'help/2' })
    const next = withView(search, { center: 'help/3', expanded: ['help/3/1'] })
    expect(next).toEqual({
      center: 'help/3',
      expanded: ['help/3/1'],
      context: undefined,
      open: 'help/2',
    })
    expect(viewOf(next)).toEqual({ center: 'help/3', expanded: ['help/3/1'], context: undefined })
  })

  it('opens a Body and closes it, keeping the view', () => {
    const search = readHelpSearch({ center: 'help/4', context: true })
    const opened = withOpen(search, 'help/4')
    expect(opened).toMatchObject({ center: 'help/4', context: true, open: 'help/4' })
    expect(withOpen(opened, undefined)).toEqual({ ...search, open: undefined })
  })
})
