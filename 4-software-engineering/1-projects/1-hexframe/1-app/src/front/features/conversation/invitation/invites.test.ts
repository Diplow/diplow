import { describe, expect, it } from 'vitest'

import type { Entry } from '#/domains/assistant/entities'
import type { SystemTile } from '#/domains/mapping/entities'

import { invitesTutorial } from './invites'

// When the chat invites a new account's first command, on a Root and Entries made by hand: shown
// once the Root is named, then gone once a Tile stands below it or something is said.

const at = (minute: number) => new Date(2026, 9, 17, 16, minute)

const tile = (
  id: string,
  title: string,
  below: Partial<Pick<SystemTile, 'branches' | 'leaves' | 'context'>> = {},
): SystemTile => ({
  _tag: 'Tile',
  id,
  title,
  preview: '',
  body: '',
  version: 1,
  branches: {},
  leaves: {},
  context: {},
  ...below,
})

const ada = tile('root', 'Ada')

// What the Conversation holds once a new account named its Root: the change that named it.
const named: Entry = {
  _tag: 'Change',
  id: 'named',
  at: at(30),
  verb: 'TileEdited',
  tile: { id: 'root', title: 'Ada' },
  actor: { _tag: 'You' },
}

// Where the user went since: the Root opened.
const went: Entry = {
  _tag: 'Navigation',
  id: 'went',
  at: at(31),
  steps: [{ gesture: 'expand', tile: 'root' }],
  gestures: 1,
}

const said = (author: 'user' | 'agent'): Entry => ({
  _tag: 'Message',
  id: author,
  at: at(32),
  author,
  text: 'Hello',
})

describe('invitesTutorial', () => {
  it('invites once the Root is named, nothing below it and nothing said', () => {
    expect(invitesTutorial(ada, [], false)).toBe(true)
    expect(invitesTutorial(ada, [named, went], false)).toBe(true)
  })

  it('invites nothing while the Root waits for its name', () => {
    expect(invitesTutorial(tile('root', ''), [], false)).toBe(false)
  })

  it('goes once a Child stands below the Root, or a Context Tile', () => {
    const holding = (below: Parameters<typeof tile>[2]) =>
      invitesTutorial(tile('root', 'Ada', below), [named], false)
    expect(holding({ branches: { 1: tile('work', 'Work') } })).toBe(false)
    expect(holding({ leaves: { 3: tile('notes', 'Notes') } })).toBe(false)
    expect(holding({ context: { [-1]: tile('why', 'Why') } })).toBe(false)
  })

  it('goes once something is said: a Message held, by either voice, or one on its way', () => {
    expect(invitesTutorial(ada, [named, said('user')], false)).toBe(false)
    expect(invitesTutorial(ada, [named, said('agent')], false)).toBe(false)
    expect(invitesTutorial(ada, [named], true)).toBe(false)
  })
})
