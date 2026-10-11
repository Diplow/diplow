import { describe, expect, it } from 'vitest'

import { commandGroups, commands, commandsMatching, marked } from './commands'

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

describe('marked', () => {
  it('cuts a text around what was typed, where it first shows, case and accents aside', () => {
    expect(marked('Déplacer', 'depl')).toEqual({ before: '', match: 'Dépl', after: 'acer' })
    expect(marked('Software engineering', 'ENG')).toEqual({
      before: 'Software ',
      match: 'eng',
      after: 'ineering',
    })
  })

  it('marks nothing when nothing was typed, or what was typed is not there', () => {
    expect(marked('Projects', '')).toBeUndefined()
    expect(marked('Projects', 'site')).toBeUndefined()
  })
})
