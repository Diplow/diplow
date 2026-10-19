import { Result } from 'effect'
import { describe, expect, it } from 'vitest'

import {
  type Actor,
  type Grant,
  lineageOf,
  type PlacedTile,
  rightsOn,
  sharingOf,
  type Slot,
  type System,
} from '../../entities'
import {
  allowed,
  allowedBatch,
  allowedThrough,
  type Batched,
  CreateReference,
  CreateTile,
  DeleteReference,
  DeleteTile,
  EditTile,
  grantableTo,
  may,
  mayShare,
  MoveTile,
  type Operation,
  type OperationEvent,
  shownAllowed,
  SwapTiles,
  TileCreated,
  TileDeleted,
  TileMoved,
} from '..'
import { agentAllowed, runsAgent } from './may'

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

  it('asks nothing of a target the System does not hold, a pin, which the service read first', () => {
    const pin = new CreateReference({
      parent: id.garden,
      parentVersion: 1,
      slot: -1,
      target: id.nowhere,
    })
    // Write on the slot's Tile is still asked; read on another System's Tile is the service's.
    expect(verdict(bob, pin)).toBe('ok')
    const onSquare = new CreateReference({
      parent: id.square,
      parentVersion: 1,
      slot: -1,
      target: id.nowhere,
    })
    expect(verdict(stranger, onSquare)).toBe('NotAllowed')
  })

  it('refuses a delete over a subtree holding a Tile set to none for the actor', () => {
    expect(verdict(bob, new DeleteTile({ id: id.journal, version: 1 }))).toBe('NotAllowed')
  })

  it('refuses a delete without a Session of a Tile carrying a Grant, which no undo puts back', () => {
    const square = new DeleteTile({ id: id.square, version: 1 })
    expect(verdict(actor('ana', false), square)).toBe('NotAllowed')
    expect(verdict(ana, square)).toBe('ok')
    expect(verdict(actor('ana', false), new DeleteTile({ id: id.garden, version: 1 }))).toBe('ok')
  })

  it('refuses the same delete to anyone but the owner, from a Session too: its owner may undo it', () => {
    const writes = sharingOf('ana', lineageOf(system), [
      bobsGrant,
      { tile: id.square, subject: { _tag: 'Everyone' }, value: 'read' },
    ])
    expect(verdict(bob, new DeleteTile({ id: id.square, version: 1 }), writes)).toBe('NotAllowed')
    expect(verdict(bob, new DeleteTile({ id: id.bench, version: 1 }), writes)).toBe('ok')
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

describe('a move that would widen who may do what', () => {
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

describe('a move that would give a right other than read', () => {
  it('is refused too: Family, reading Garden, would write it under Journal', () => {
    const family = { _tag: 'Group', id: 'family' } as const
    const writable = sharingOf('ana', lineageOf(system), [
      bobsGrant,
      { tile: id.ana, subject: family, value: 'read' },
      { tile: id.journal, subject: family, value: 'read+write' },
    ])
    expect(verdict(bob, move(id.garden, id.journal, 3), writable)).toBe('NotAllowed')
    expect(verdict(ana, move(id.garden, id.journal, 3), writable)).toBe('ok')
    expect(verdict(bob, move(id.entry, id.garden, 1), writable)).toBe('ok')
  })
})

describe('a batch, run by its owner', () => {
  const movedUnder = (tile: string, parent: string, slot: Slot) =>
    new TileMoved({ id: tile, parent, slot })
  const deleted = (tile: string) => new TileDeleted({ id: tile, title: tile })
  const created = (tile: string, parent: string, slot: Slot) =>
    new TileCreated({ id: tile, parent, slot, title: tile, preview: '', body: '' })
  const batchVerdict = (who: Actor, events: ReadonlyArray<OperationEvent>) => {
    const result = allowedBatch(who, { owner: 'ana', grants }, system, events)
    return Result.isFailure(result) ? result.failure._tag : 'ok'
  }

  it('is refused without a Session when it leaves a Tile that stood before open to someone', () => {
    const opened = [movedUnder(id.garden, id.square, 2)]
    expect(batchVerdict(actor('ana', false), opened)).toBe('NotAllowed')
    expect(batchVerdict(ana, opened)).toBe('ok')
  })

  it('is refused without a Session when it deletes a Tile carrying a Grant, which no undo puts back', () => {
    expect(batchVerdict(actor('ana', false), [deleted(id.square)])).toBe('NotAllowed')
    expect(batchVerdict(ana, [deleted(id.square)])).toBe('ok')
    expect(batchVerdict(actor('ana', false), [deleted(id.entry)])).toBe('ok')
  })

  it('goes through when it opens nothing that stood, a Tile it makes under a public one included', () => {
    expect(batchVerdict(actor('ana', false), [movedUnder(id.entry, id.garden, 1)])).toBe('ok')
    expect(batchVerdict(actor('ana', false), [created(uuid(), id.square, 2)])).toBe('ok')
  })

  it('takes a Tile it deletes and makes again under the same id for a new one, with no Grant of its own', () => {
    // Secret, kept from Bob, made again where it stood: its delete took the Grant, so Bob would read it.
    const remade = [deleted(id.secret), created(id.secret, id.journal, 2)]
    expect(batchVerdict(actor('ana', false), remade)).toBe('NotAllowed')
    expect(batchVerdict(ana, remade)).toBe('ok')
    // Made again elsewhere, a Tile with no Grant opens nothing: a new Tile, as any it makes.
    const elsewhere = [deleted(id.entry), created(id.entry, id.square, 2)]
    expect(batchVerdict(actor('ana', false), elsewhere)).toBe('ok')
  })
})

describe('a batch folded for anyone but its owner', () => {
  it('never deletes a Tile carrying a Grant, so one it makes again under that id carries none', () => {
    const family = { _tag: 'Group', id: 'family' } as const
    const kept: ReadonlyArray<Grant> = [
      bobsGrant,
      { tile: id.garden, subject: family, value: 'none' },
    ]
    const again = new CreateTile({
      parent: id.ana,
      slot: 2,
      title: 'Garden',
      preview: '',
      body: '',
    })
    const remade: ReadonlyArray<Batched> = [
      { operation: new DeleteTile({ id: id.garden, version: 1 }) },
      { operation: again, made: id.garden },
    ]
    const result = allowedThrough(bob, { owner: 'ana', grants: kept }, system, remade)
    expect(Result.isFailure(result) && result.failure._tag).toBe('NotAllowed')
    // Without the Grant, its delete goes through, and so does the Tile made again.
    const open = allowedThrough(bob, { owner: 'ana', grants: [bobsGrant] }, system, remade)
    expect(Result.isSuccess(open)).toBe(true)
  })
})

describe('who may change who reaches a Tile', () => {
  const shareVerdict = (who: Actor, tile: string) => {
    const result = mayShare(who, { system, sharing }, tile)
    return Result.isFailure(result) ? result.failure._tag : 'ok'
  }

  it('is its owner, from a Session, on any Tile of the System, its star included', () => {
    for (const tile of [id.ana, id.secret, id.bench]) expect(shareVerdict(ana, tile)).toBe('ok')
  })

  it('refuses the owner through a Key, a Turn’s Key or an agent NotAllowed', () => {
    expect(shareVerdict(actor('ana', false), id.garden)).toBe('NotAllowed')
  })

  it('refuses anyone else NotAllowed where they read, TileNotFound where they may not', () => {
    // Bob writes from Ana's star down, and still sets nothing there.
    expect(shareVerdict(bob, id.garden)).toBe('NotAllowed')
    expect(shareVerdict(stranger, id.square)).toBe('NotAllowed')
    expect(shareVerdict(bob, id.secret)).toBe('TileNotFound')
    expect(shareVerdict(stranger, id.garden)).toBe('TileNotFound')
    expect(shareVerdict(ana, id.nowhere)).toBe('TileNotFound')
  })
})

describe('who a Grant may name', () => {
  it('is anyone but the owner, who may do everything there already', () => {
    expect(Result.isSuccess(grantableTo(sharing, 'bob'))).toBe(true)
    expect(Result.isSuccess(grantableTo(sharing, 'cleo'))).toBe(true)
    const owner = grantableTo(sharing, 'ana')
    expect(Result.isFailure(owner) && owner.failure._tag).toBe('NotAllowed')
  })
})

describe('what the rights a reader was shown let them make, as the client foresees it', () => {
  // Bob's rights as `Seen` carries them, on the System as he sees it: Secret is kept from him.
  const shownTiles = Object.fromEntries(
    Object.entries(system.tiles).filter(([tile]) => tile !== id.secret),
  )
  const shown: System = { ...system, tiles: shownTiles }
  const rights = Object.fromEntries(
    [id.ana, ...Object.keys(shownTiles)].map((tile) => [tile, [...rightsOn(bob, sharing, tile)]]),
  )
  const stranger = Object.fromEntries(
    [id.ana, ...Object.keys(shownTiles)].map((tile) => [
      tile,
      [...rightsOn(actor('stranger'), sharing, tile)],
    ]),
  )

  it('agrees with `allowed` on what the reader sees, read and write alike', () => {
    for (const operation of [
      edit(id.entry),
      edit(id.square),
      new DeleteTile({ id: id.garden, version: 1 }),
      move(id.garden, id.journal, 3),
      new SwapTiles({ a: id.garden, aVersion: 1, b: id.square, bVersion: 1 }),
      new CreateTile({ parent: id.bench, slot: 1, title: 'New', preview: '', body: '' }),
    ]) {
      expect(shownAllowed(rights, shown, operation)).toBe(verdict(bob, operation) === 'ok')
      expect(shownAllowed(stranger, shown, operation)).toBe(false)
    }
    expect(shownAllowed(stranger, shown, edit(id.garden))).toBe(false)
  })

  it('reads a Reference by the Tile holding it, and a Tile it is not shown as none', () => {
    const pinned: System = {
      ...shown,
      tiles: {
        ...shown.tiles,
        pin: { _tag: 'Reference', id: 'pin', parent: id.garden, slot: -1, target: id.entry },
      },
    }
    expect(shownAllowed(rights, pinned, new DeleteTile({ id: id.garden, version: 1 }))).toBe(true)
    expect(shownAllowed(rights, shown, edit(id.secret))).toBe(false)
  })
})

describe('where the agent may run, its *@*', () => {
  it('answers the rights with @, refuses read alone, and keeps a Tile unread or none', () => {
    expect(Result.getOrThrow(agentAllowed(new Set(['@', 'read']), { isTile: true }))).toEqual([
      'read',
      '@',
    ])
    const tagOf = (refused: Result.Result<unknown, { readonly _tag: string }>) =>
      Result.isFailure(refused) ? refused.failure._tag : undefined
    expect(tagOf(agentAllowed(new Set(['read', 'write']), { isTile: true }))).toBe('NotAllowed')
    expect(tagOf(agentAllowed(new Set(['read', '@']), { isTile: false }))).toBe('TileNotFound')
    expect(tagOf(agentAllowed(new Set(), { isTile: true }))).toBe('TileNotFound')
    expect(runsAgent(['read', '@'])).toBe(true)
    expect(runsAgent(['read', 'write'])).toBe(false)
  })
})
