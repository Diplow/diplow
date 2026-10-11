import { describe, expect, it } from 'vitest'

import { commandGroups, commands, commandsMatching, cutAround } from './commands'

const ids = (typed: string) => commandsMatching(typed).map((command) => command.id)

describe('commandsMatching', () => {
  it('offers every command, group after group, with nothing typed', () => {
    expect(ids('')).toEqual(commands.map((command) => command.id))
    const groups = commands.map((command) => commandGroups.indexOf(command.group))
    expect(groups).toEqual([...groups].sort((a, b) => a - b))
  })

  it('finds a command by the start of its name, case aside', () => {
    expect(ids('mo')).toEqual(['move'])
    expect(ids('E')).toEqual(['edit', 'export'])
  })

  it('finds the language by its name in every language', () => {
    expect(ids('langu')).toContain('language')
    expect(ids('langue')).toEqual(['language'])
  })

  it('finds, from two characters on, a command by the start of a word of what it does', () => {
    expect(ids('zip')).toEqual(['export'])
    expect(ids('la')).toEqual(['language', 'undo'])
    expect(ids('ex')).toEqual(['export'])
    expect(ids('a')).toEqual(['ask', 'apply'])
  })

  it('finds nothing for what no command holds', () => {
    expect(ids('xyz')).toEqual([])
  })
})

describe('cutAround', () => {
  it('cuts a text around what was typed, where it first shows, case and accents aside', () => {
    expect(cutAround('Déplacer', 'depl')).toEqual({ before: '', match: 'Dépl', after: 'acer' })
    expect(cutAround('Software engineering', 'ENG')).toEqual({
      before: 'Software ',
      match: 'eng',
      after: 'ineering',
    })
  })

  it('keeps its place in decomposed text, a mark apart from its letter', () => {
    expect(cutAround('De\u0301placer', 'pla')).toEqual({
      before: 'De\u0301',
      match: 'pla',
      after: 'cer',
    })
  })

  it('cuts nothing when nothing was typed, or what was typed is not there', () => {
    expect(cutAround('Projects', '')).toBeUndefined()
    expect(cutAround('Projects', 'site')).toBeUndefined()
  })
})
