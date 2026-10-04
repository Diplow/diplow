import { describe, expect, it } from 'vitest'

import { followed } from './follow.ts'

const inPaired = (path: string) => ({ path, inPaired: true })
const elsewhere = (path: string) => ({ path, inPaired: false })

describe('followed', () => {
  it('moves onto the folder whose CLAUDE.md the paired pane opens', () => {
    expect(followed(inPaired('3-games/CLAUDE.md'), undefined, '')).toEqual({
      folder: '3-games',
      seen: '3-games/CLAUDE.md',
    })
  })

  it('moves onto the folder whose -CLAUDE.md the paired pane opens', () => {
    expect(followed(inPaired('4-software-engineering/-CLAUDE.md'), undefined, '3-games')).toEqual({
      folder: '4-software-engineering',
      seen: '4-software-engineering/-CLAUDE.md',
    })
  })

  it('moves onto a dot folder, as a click on a Context hex does', () => {
    expect(followed(inPaired('.skills/CLAUDE.md'), undefined, '').folder).toBe('.skills')
  })

  it("moves up to the vault root on the root's own note", () => {
    expect(followed(inPaired('CLAUDE.md'), undefined, '3-games').folder).toBe('')
  })

  it('stays on an open in any other pane, and keeps what it saw', () => {
    expect(followed(elsewhere('3-games/CLAUDE.md'), '5-startups/CLAUDE.md', '')).toEqual({
      seen: '5-startups/CLAUDE.md',
    })
  })

  it("stays on a file that isn't a folder's note, and sees it", () => {
    expect(followed(inPaired('3-games/riftbound.md'), undefined, '')).toEqual({
      seen: '3-games/riftbound.md',
    })
    expect(followed(inPaired('3-games/STACK.md'), undefined, '').folder).toBeUndefined()
    expect(followed(inPaired('3-games/NOT-CLAUDE.md'), undefined, '').folder).toBeUndefined()
  })

  it('stays when the note it saw last opens again', () => {
    expect(followed(inPaired('3-games/CLAUDE.md'), '3-games/CLAUDE.md', '')).toEqual({
      seen: '3-games/CLAUDE.md',
    })
  })

  it('stays on the note of the folder it is already on', () => {
    expect(followed(inPaired('3-games/CLAUDE.md'), undefined, '3-games').folder).toBeUndefined()
    expect(followed(inPaired('CLAUDE.md'), undefined, '').folder).toBeUndefined()
  })

  it('follows a note it showed itself once the pane has opened another one in between', () => {
    const shown = '3-games/CLAUDE.md'
    const away = followed(inPaired('3-games/riftbound.md'), shown, '')
    expect(followed(inPaired(shown), away.seen, '')).toEqual({ folder: '3-games', seen: shown })
  })

  it('says nothing more when the user comes back to a note it already followed or refused', () => {
    const first = followed(inPaired('5-startups/CLAUDE.md'), undefined, '')
    expect(first.folder).toBe('5-startups')
    expect(followed(inPaired('5-startups/CLAUDE.md'), first.seen, '').folder).toBeUndefined()
  })
})
