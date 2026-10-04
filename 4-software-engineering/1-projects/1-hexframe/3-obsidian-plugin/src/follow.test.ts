import { describe, expect, it } from 'vitest'

import { followed } from './follow.ts'

const inPaired = (path: string) => ({ path, inPaired: true })

describe('followed', () => {
  it('moves onto the folder whose CLAUDE.md the paired pane opens', () => {
    expect(followed(inPaired('3-games/CLAUDE.md'), undefined, '')).toBe('3-games')
  })

  it('moves onto the folder whose -CLAUDE.md the paired pane opens', () => {
    expect(followed(inPaired('4-software-engineering/-CLAUDE.md'), undefined, '3-games')).toBe(
      '4-software-engineering',
    )
  })

  it('moves onto a dot folder, as a click on a Context hex does', () => {
    expect(followed(inPaired('.skills/CLAUDE.md'), undefined, '')).toBe('.skills')
  })

  it("moves up to the vault root on the root's own note", () => {
    expect(followed(inPaired('CLAUDE.md'), undefined, '3-games')).toBe('')
  })

  it('stays on an open in any other pane', () => {
    expect(followed({ path: '3-games/CLAUDE.md', inPaired: false }, undefined, '')).toBeUndefined()
  })

  it("stays on a file that isn't a folder's note", () => {
    expect(followed(inPaired('3-games/riftbound.md'), undefined, '')).toBeUndefined()
    expect(followed(inPaired('3-games/STACK.md'), undefined, '')).toBeUndefined()
    expect(followed(inPaired('3-games/NOT-CLAUDE.md'), undefined, '')).toBeUndefined()
  })

  it('stays on the note the view itself showed there', () => {
    expect(followed(inPaired('3-games/CLAUDE.md'), '3-games/CLAUDE.md', '')).toBeUndefined()
  })

  it('moves once the paired pane opens a note other than the one the view showed', () => {
    expect(followed(inPaired('5-startups/CLAUDE.md'), '3-games/CLAUDE.md', '')).toBe('5-startups')
  })

  it('stays on the note of the folder it is already on', () => {
    expect(followed(inPaired('3-games/CLAUDE.md'), undefined, '3-games')).toBeUndefined()
    expect(followed(inPaired('CLAUDE.md'), undefined, '')).toBeUndefined()
  })
})
