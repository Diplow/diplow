import { describe, expect, it } from 'vitest'

import { blocksOf, firstNumbered, linesOf, plainOf, weave } from './words'

const projects = { tile: { title: 'Projects' } }
const site = { tile: { title: 'Site' } }

describe('weave', () => {
  it('weaves each tile in where the sentence puts it', () => {
    const english = (inputs: { site: string; projects: string }) =>
      `Move ${inputs.site} into ${inputs.projects}`
    expect(weave(english, { site, projects })).toEqual(['Move ', site, ' into ', projects])
  })

  it('follows a language that names them in the other order', () => {
    const reversed = (inputs: { site: string; projects: string }) =>
      `Into ${inputs.projects}, move ${inputs.site}`
    expect(weave(reversed, { site, projects })).toEqual(['Into ', projects, ', move ', site])
  })

  it('weaves a tile that opens or ends the sentence, with no empty words around it', () => {
    const bare = (inputs: { site: string }) => inputs.site
    expect(weave(bare, { site })).toEqual([site])
  })

  it('leaves a sentence that names no tile as it is', () => {
    expect(weave(() => 'Thinking', {})).toEqual(['Thinking'])
  })

  it('weaves who acted, by name, as a tile', () => {
    const edited = (inputs: { key: string; projects: string }) =>
      `${inputs.key} edited ${inputs.projects}`
    const key = { name: 'Claude Code, laptop' }
    expect(weave(edited, { key, projects })).toEqual([key, ' edited ', projects])
  })

  it('weaves a command named where the sentence puts it', () => {
    const invite = (inputs: { command: string }) => `Type ${inputs.command} to reach it.`
    const command = { command: { name: '/tutorial', onRun: () => undefined } }
    expect(weave(invite, { command })).toEqual(['Type ', command, ' to reach it.'])
  })
})

describe('plainOf', () => {
  it('reads each tile by its title and each name as it is', () => {
    expect(plainOf(['Move ', site, ' for ', { name: 'a Key' }, '.'])).toBe('Move Site for a Key.')
  })

  it('reads a command named as it is typed', () => {
    const command = { command: { name: '/tutorial', onRun: () => undefined } }
    expect(plainOf(['Type ', command, '.'])).toBe('Type /tutorial.')
  })
})

describe('linesOf', () => {
  it('cuts the text where it breaks a line, a tile kept whole on its line', () => {
    expect(linesOf(['See ', site, ' now\nthen ', projects])).toEqual([
      ['See ', site, ' now'],
      ['then ', projects],
    ])
  })

  it('keeps a blank line, as an empty one', () => {
    expect(linesOf(['First\n\nThird'])).toEqual([['First'], [], ['Third']])
  })

  it('opens a line with a tile that follows a break', () => {
    expect(linesOf(['Look:\n', site])).toEqual([['Look:'], [site]])
  })

  it('draws no line after a last break, as a reader sees none', () => {
    expect(linesOf(['Done\n'])).toEqual([['Done']])
  })

  it('leaves a text of one line, or none, as one line', () => {
    expect(linesOf(['One line'])).toEqual([['One line']])
    expect(linesOf([])).toEqual([[]])
  })
})

describe('blocksOf', () => {
  it('gathers the lines opening with a number and a dot into one list, the rest lines', () => {
    const body = ['Here, the steps.\n\n1. Go in: the center.\n2. Six at most.\n\nOpen it.']
    expect(blocksOf(body)).toEqual([
      { line: ['Here, the steps.'] },
      { line: [] },
      {
        list: [
          { number: '1', words: ['Go in: the center.'] },
          { number: '2', words: ['Six at most.'] },
        ],
      },
      { line: [] },
      { line: ['Open it.'] },
    ])
  })

  it('keeps a tile an item names, and its number as written', () => {
    expect(blocksOf(['3. Read ', projects, '\n4. Then ', site])).toEqual([
      {
        list: [
          { number: '3', words: ['Read ', projects] },
          { number: '4', words: ['Then ', site] },
        ],
      },
    ])
  })

  it('leaves a line that opens with a tile, or a number without its dot, a line', () => {
    expect(blocksOf([projects, ' 1. first\n2020 was a year'])).toEqual([
      { line: [projects, ' 1. first'] },
      { line: ['2020 was a year'] },
    ])
  })
})

describe('firstNumbered', () => {
  it('names each number by its first item, a later item with the same number naming nothing', () => {
    const first = firstNumbered(
      blocksOf(['1. Go in.\n2. Six at most.\n\nAgain:\n\n1. Go in, again.']),
    )
    expect([first(0, 0), first(0, 1), first(2, 0)]).toEqual([true, true, false])
  })

  it('names nothing by a line that is no list item', () => {
    expect(firstNumbered(blocksOf(['Here.\n1. Go in.']))(0, 0)).toBe(false)
  })
})
