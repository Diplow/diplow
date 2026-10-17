import { Result } from 'effect'
import { describe, expect, it } from 'vitest'

import {
  type Actor,
  type Grant,
  lineageOf,
  type PlacedTile,
  sharingOf,
  type Slot,
  type System,
} from '../../entities'
import {
  allowed,
  CreateReference,
  CreateTile,
  DeleteReference,
  DeleteTile,
  EditTile,
  may,
  MoveTile,
  type Operation,
  SwapTiles,
} from '..'

// What each Operation needs of the Tiles it names, carries and lands under, on a System made by hand:
// `read` on what it names, else `TileNotFound`; `write` on what it changes, carries and goes under,
// else `NotAllowed`; and no move that lets someone read a Tile they could not before, but by the
// owner from a Session. How Grants resolve is `../../entities/rights/rights.test.ts`'s; the service
// asking it over PGlite, `./shared.test.ts`'s.

const uuid = () => crypto.randomUUID()

const id = {
  ana: uuid(),
  journal: uuid(),
  entry: uuid(),
  secret: uuid(),
  garden: uuid(),
  square: uuid(),
  bench: uuid(),
  nowhere: uuid(),
}

const placed = (tileId: string, parent: string, slot: Slot): PlacedTile => ({
  _tag: 'Tile',
  id: tileId,
  title: tileId,
  preview: '',
  body: '',
  version: 1,
  parent,
  slot,
})

// Ana's star holds `journal`, which holds `entry` and `secret`; `garden`; and `square`, which Everyone
// reads, and `bench` below it. Bob may write from Ana's star down, but `secret` is set to none for him.
const system: System = {
  root: { _tag: 'Tile', id: id.ana, title: 'Ana', preview: '', body: '', version: 1 },
  tiles: {
    [id.journal]: placed(id.journal, id.ana, 1),
    [id.entry]: placed(id.entry, id.journal, 1),
    [id.secret]: placed(id.secret, id.journal, 2),
    [id.garden]: placed(id.garden, id.ana, 2),
    [id.square]: placed(id.square, id.ana, 3),
    [id.bench]: placed(id.bench, id.square, 1),
  },
  owned: true,
  version: 1,
}

const bobsGrant: Grant = {
  tile: id.ana,
  subject: { _tag: 'Account', id: 'bob' },
  value: 'read+write',
}
const grants: ReadonlyArray<Grant> = [
  bobsGrant,
  { tile: id.secret, subject: { _tag: 'Account', id: 'bob' }, value: 'none' },
  { tile: id.square, subject: { _tag: 'Everyone' }, value: 'read' },
]
const sharing = sharingOf('ana', lineageOf(system), grants)

const actor = (account: string, session = true): Actor => ({
  account,
  groups: [],
  owners: [account],
  session,
})
const [ana, bob, stranger] = [actor('ana'), actor('bob'), actor('stranger')]

/** What `allowed` answers, the refusal's tag or `ok`. */
const verdict = (who: Actor, operation: Operation, on = sharing) => {
  const result = allowed(who, { system, sharing: on }, operation)
  return Result.isFailure(result) ? result.failure._tag : 'ok'
}

const edit = (tile: string) => new EditTile({ id: tile, version: 1, title: 'Changed' })
const move = (tile: string, parent: string, slot: Slot) =>
  new MoveTile({ id: tile, version: 1, parent, slot })

describe('may', () => {
  it('answers one right on one Tile', () => {
    expect(may(bob, sharing, id.entry, 'write')).toBe(true)
    expect(may(bob, sharing, id.entry, '@')).toBe(false)
    expect(may(bob, sharing, id.secret, 'read')).toBe(false)
    expect(may(stranger, sharing, id.square, 'read')).toBe(true)
    expect(may(stranger, sharing, id.garden, 'read')).toBe(false)
  })
})

describe('what an Operation needs', () => {
  it('refuses a Tile the actor may not read TileNotFound, as one that is not there', () => {
    expect(verdict(stranger, edit(id.garden))).toBe('TileNotFound')
    expect(verdict(bob, edit(id.secret))).toBe('TileNotFound')
    expect(verdict(ana, edit(id.nowhere))).toBe('TileNotFound')
    const pin = new CreateReference({
      parent: id.garden,
      parentVersion: 1,
      slot: -1,
      target: id.secret,
    })
    expect(verdict(bob, pin)).toBe('TileNotFound')
  })

  it('refuses a Tile read but not written NotAllowed', () => {
    expect(verdict(stranger, edit(id.square))).toBe('NotAllowed')
    const under = new CreateTile({
      parent: id.square,
      slot: 1,
      title: 'Mine',
      preview: '',
      body: '',
    })
    expect(verdict(stranger, under)).toBe('NotAllowed')
    expect(
      verdict(stranger, new DeleteReference({ parent: id.square, parentVersion: 1, slot: -1 })),
    ).toBe('NotAllowed')
  })

  it('lets a writer edit, create under and delete what it writes, and the owner anything', () => {
    expect(verdict(bob, edit(id.entry))).toBe('ok')
    const under = new CreateTile({
      parent: id.garden,
      slot: 1,
      title: 'New',
      preview: '',
      body: '',
    })
    expect(verdict(bob, under)).toBe('ok')
    expect(verdict(bob, new DeleteTile({ id: id.garden, version: 1 }))).toBe('ok')
    const pin = new CreateReference({
      parent: id.garden,
      parentVersion: 1,
      slot: -1,
      target: id.entry,
    })
    expect(verdict(bob, pin)).toBe('ok')
    expect(verdict(ana, new DeleteTile({ id: id.journal, version: 1 }))).toBe('ok')
    expect(verdict(actor('ana', false), edit(id.secret))).toBe('ok')
  })

  it('refuses a delete over a subtree holding a Tile set to none for the actor', () => {
    expect(verdict(bob, new DeleteTile({ id: id.journal, version: 1 }))).toBe('NotAllowed')
  })

  it('refuses a move without write on what it carries, or on the parent it lands under', () => {
    expect(verdict(bob, move(id.journal, id.garden, 1))).toBe('NotAllowed')
    const readOnly = sharingOf('ana', lineageOf(system), [
      bobsGrant,
      { tile: id.square, subject: { _tag: 'Account', id: 'bob' }, value: 'read' },
    ])
    expect(verdict(bob, move(id.garden, id.square, 1), readOnly)).toBe('NotAllowed')
    expect(verdict(bob, move(id.garden, id.journal, 3), readOnly)).toBe('ok')
  })
})

describe('a move that would widen who reads', () => {
  const inherits = move(id.garden, id.square, 1)

  it('is refused to anyone but the owner: Bob’s move of an inheriting Tile under a public parent', () => {
    expect(verdict(bob, inherits)).toBe('NotAllowed')
  })

  it('goes through for the owner from a Session, and is refused to the owner without one', () => {
    expect(verdict(ana, inherits)).toBe('ok')
    expect(verdict(actor('ana', false), inherits)).toBe('NotAllowed')
  })

  it('goes through when nobody would read anything new: within a parent, or under a Tile no wider', () => {
    expect(verdict(bob, move(id.garden, id.ana, 4))).toBe('ok')
    expect(verdict(bob, move(id.entry, id.garden, 1))).toBe('ok')
    expect(verdict(actor('ana', false), move(id.square, id.garden, 1))).toBe('ok')
  })

  it('leaves a move under a Tile it carries to `decide`, which refuses it', () => {
    expect(verdict(actor('ana', false), move(id.ana, id.ana, 1))).toBe('ok')
    expect(verdict(actor('ana', false), move(id.journal, id.entry, 3))).toBe('ok')
  })

  it('is refused for a swap too, whichever of the two it would open', () => {
    const swap = new SwapTiles({ a: id.entry, aVersion: 1, b: id.bench, bVersion: 1 })
    expect(verdict(bob, swap)).toBe('NotAllowed')
    expect(verdict(ana, swap)).toBe('ok')
    const level = new SwapTiles({ a: id.garden, aVersion: 1, b: id.entry, bVersion: 1 })
    expect(verdict(bob, level)).toBe('ok')
  })
})
