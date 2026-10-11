import { describe, expect, it } from 'vitest'

import { m } from '#/paraglide/messages'

import {
  commandGroups,
  commandMarkOf,
  commandPicked,
  commands,
  commandsMatching,
  commandTypingAt,
  languageNamed,
  openingCommand,
} from './commands'

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

describe('a page offering some commands', () => {
  const among = commands.filter((command) => ['ask', 'apply', 'language'].includes(command.id))
  const rows = (before: string) =>
    commandTypingAt(before, among)?.listing.groups.flatMap((group) =>
      group.rows.map((row) => row.id),
    )

  it('lists only those it offers, by name or by what they do', () => {
    expect(rows('/')).toEqual(['ask', 'apply', 'language'])
    expect(rows('/a')).toEqual(['ask', 'apply'])
    expect(rows('/zip')).toEqual([])
    expect(commandsMatching('mo', among)).toEqual([])
  })

  it('lists the commands while a `/` opens the field and no space came, the languages after the language', () => {
    expect(commandTypingAt('/', among)?.kind).toBe('command')
    expect(commandTypingAt('so /', among)).toBeUndefined()
    expect(commandTypingAt('/ask ', among)).toBeUndefined()
    const languages = commandTypingAt(`/${m.composer_command_language()} fr`, among)
    expect(languages?.kind).toBe('language')
    expect(languages?.from).toBe(m.composer_command_language().length + 2)
    expect(languages?.listing.groups.flatMap((group) => group.rows.map((row) => row.id))).toEqual([
      'fr',
    ])
  })

  it('finds the command a Message opens with, and what follows it, never one it does not offer', () => {
    expect(openingCommand('/ask', among)).toMatchObject({ command: { id: 'ask' }, rest: '' })
    expect(openingCommand('/language  fr ', among)).toMatchObject({
      command: { id: 'language' },
      length: '/language'.length,
      rest: 'fr',
    })
    expect(openingCommand('/ASK', among)).toMatchObject({ command: { id: 'ask' } })
    expect(openingCommand('/Langue fr', among)).toMatchObject({ command: { id: 'language' } })
    expect(openingCommand('/asking', among)).toBeUndefined()
    expect(openingCommand('/undo', among)).toBeUndefined()
    expect(openingCommand('ask /ask', among)).toBeUndefined()
  })

  it('marks the command a Message opens with, and nothing else', () => {
    expect(commandMarkOf('/apply now', among)).toEqual([{ from: 0, to: 6, kind: 'command' }])
    expect(commandMarkOf('/edit @Work', among)).toEqual([])
  })

  it('puts a command picked in the field, the `@` search open when it takes a Tile', () => {
    const typing = commandTypingAt('/ed')
    if (typing === undefined) throw new Error('no typing')
    expect(commandPicked('/ed', 3, typing, 'edit')).toEqual({
      value: `/${m.composer_command_edit()} @`,
      caret: m.composer_command_edit().length + 3,
    })
    const languages = commandTypingAt('/language ')
    if (languages === undefined) throw new Error('no typing')
    expect(commandPicked('/language ', 10, languages, 'fr')).toEqual({ language: 'fr' })
  })
})

describe('languageNamed', () => {
  it('names a language by its code or by what its own name holds, case and accents aside', () => {
    expect(languageNamed('fr')).toBe('fr')
    expect(languageNamed('FRAN')).toBe('fr')
    expect(languageNamed('français')).toBe('fr')
    expect(languageNamed('eng')).toBe('en')
  })

  it('names none for nothing, or a language hexframe is not in', () => {
    expect(languageNamed('')).toBeUndefined()
    expect(languageNamed('deutsch')).toBeUndefined()
  })
})
