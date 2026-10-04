import { describe, expect, it } from 'vitest'

import { listRows, wrap } from './text.ts'

describe('wrap', () => {
  it('fills lines of at most the width, word by word', () => {
    expect(wrap('Who I am and what I aim at', 10, 4)).toEqual(['Who I am', 'and what I', 'aim at'])
  })

  it('cuts the last line it keeps with an ellipsis', () => {
    expect(wrap('Who I am and what I aim at', 10, 2)).toEqual(['Who I am', 'and what…'])
    expect(wrap('one two three', 7, 1)).toEqual(['one tw…'])
  })

  it('cuts a word wider than a line, on a line of its own', () => {
    expect(wrap('hexframe-obsidian-plugin', 10, 2)).toEqual(['hexframe-…'])
    expect(wrap('the hexframe-obsidian-plugin is', 10, 3)).toEqual(['the', 'hexframe-…', 'is'])
  })

  it('gives no line for no words', () => {
    expect(wrap('  ', 10, 2)).toEqual([])
  })
})

describe('listRows', () => {
  it('holds six names in a hex of the first scale, ten in a collapsed center', () => {
    expect(listRows(1)).toBe(6)
    expect(listRows(2.5)).toBe(10)
  })
})
