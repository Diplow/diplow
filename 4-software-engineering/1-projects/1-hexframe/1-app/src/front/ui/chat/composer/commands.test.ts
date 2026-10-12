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
  namedAt,
  namedFirst,
  openingCommand,
  showsLink,
  wholeLink,
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

describe('a tile named from the canvas', () => {
  it('lands at the caret, a space before it where a word ends there, the caret after it', () => {
    expect(namedAt('', 0, 'Projects')).toEqual({ value: '@Projects ', caret: 10 })
    expect(namedAt('Look at', 7, 'Projects')).toEqual({ value: 'Look at @Projects ', caret: 18 })
    expect(namedAt('Look at  and', 8, 'Notes')).toEqual({ value: 'Look at @Notes and', caret: 15 })
  })

  it('opens the field to ask the agent about it, what was written kept after it', () => {
    expect(namedFirst('', 'Projects')).toEqual({ value: '@Projects ', caret: 10 })
    expect(namedFirst('tidy it', 'Projects')).toEqual({ value: '@Projects tidy it', caret: 10 })
    expect(namedFirst('', 'Software Engineering', 'a new tile, west: ')).toEqual({
      value: '@Software Engineering a new tile, west: ',
      caret: 40,
    })
  })

  it('names it once when the field opens with it already', () => {
    expect(namedFirst('@Projects tidy it', 'Projects')).toEqual({
      value: '@Projects tidy it',
      caret: 10,
    })
  })
})

describe('a link picked, as the field shows it', () => {
  it('finds a link picked shown whole at an `@`, never one a longer word goes on from', () => {
    const picked = [{ shown: '@Work' }]
    expect(showsLink('Ask @Work now', 4, picked)).toBe(true)
    expect(showsLink('Ask @Work', 4, picked)).toBe(true)
    expect(showsLink('Ask @Workshop', 4, picked)).toBe(false)
    expect(showsLink('Ask @Wor', 4, picked)).toBe(false)
  })

  it('finds each place it shows whole, opening a word, a Title holding signs read as written', () => {
    const at = (value: string, shown: string) =>
      Array.from(value.matchAll(wholeLink(shown)), ({ index }) => index)
    expect(at('@Work, then @Work team, not me@Work nor @Workshop', '@Work')).toEqual([0, 12])
    expect(at('@What? (1+1) now', '@What? (1+1)')).toEqual([0])
  })
})
