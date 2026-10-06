import { Option, Schema } from 'effect'
import { describe, expect, expectTypeOf, it } from 'vitest'

import {
  CreateReference,
  CreateTile,
  DeleteReference,
  DeleteTile,
  EditTile,
  MoveTile,
  Operation,
  type OperationName,
  SwapTiles,
} from '.'

// Mapping's Operations as data: each decodes by its tag from what a caller sends, and refuses what
// Mapping's server functions refused before they took an Operation's fields: a slot out of its six,
// a Reference outside the Context, an id that is no UUID, a string past its bound.

/** Whether an Operation decodes from this, as a caller would send it. */
const decodes = (input: unknown) => Option.isSome(Schema.decodeUnknownOption(Operation)(input))

const p = crypto.randomUUID()
const t = crypto.randomUUID()
const content = { title: 'Tile', preview: 'Tile, in short.', body: '# Tile' }

describe("Mapping's Operations", () => {
  it('decode each by its tag, into its class', () => {
    const decode = Schema.decodeUnknownSync(Operation)
    const given = [
      { _tag: 'CreateTile', parent: p, slot: 1, ...content },
      { _tag: 'EditTile', id: t, title: 'Renamed' },
      { _tag: 'MoveTile', id: t, parent: p, slot: { leaf: 2 } },
      { _tag: 'SwapTiles', a: t, b: p },
      { _tag: 'DeleteTile', id: t },
      { _tag: 'CreateReference', parent: p, slot: -3, target: t },
      { _tag: 'DeleteReference', parent: p, slot: -3 },
    ]
    const classes = [
      CreateTile,
      EditTile,
      MoveTile,
      SwapTiles,
      DeleteTile,
      CreateReference,
      DeleteReference,
    ]
    given.forEach((input, at) => {
      const operation = decode(input)
      expect(operation).toBeInstanceOf(classes[at])
      expect(operation).toMatchObject(input)
    })
  })

  it('take a Branch or a Leaf in Directions 1 to 6 and a Context slot in -1 to -6, nothing else', () => {
    const at = (slot: unknown) => ({ _tag: 'CreateTile', parent: p, slot, ...content })
    const slots = [1, 6, -1, -6, { leaf: 1 }, { leaf: 6 }]
    expect(slots.map((slot) => decodes(at(slot)))).toEqual(slots.map(() => true))
    const outside = [0, 7, -7, 1.5, { leaf: 0 }, { leaf: 7 }, { leaf: -1 }, { leaf: '1' }]
    expect(outside.map((slot) => decodes(at(slot)))).toEqual(outside.map(() => false))
    expect(decodes({ _tag: 'MoveTile', id: t, parent: p, slot: 9 })).toBe(false)
  })

  it('put a Reference in a Context slot only', () => {
    expect(decodes({ _tag: 'CreateReference', parent: p, slot: 3, target: t })).toBe(false)
    expect(decodes({ _tag: 'CreateReference', parent: p, slot: { leaf: 3 }, target: t })).toBe(
      false,
    )
    expect(decodes({ _tag: 'DeleteReference', parent: p, slot: 3 })).toBe(false)
  })

  it('name every Tile by a UUID, and only by one: no Help id, no other text', () => {
    for (const id of ['', 't', 'help', 'help/3', 'x'.repeat(36), `${t}x`]) {
      expect(decodes({ _tag: 'DeleteTile', id })).toBe(false)
      expect(decodes({ _tag: 'SwapTiles', a: t, b: id })).toBe(false)
      expect(decodes({ _tag: 'CreateReference', parent: p, slot: -1, target: id })).toBe(false)
    }
    expect(() => new MoveTile({ id: 'help/3', parent: p, slot: 2 })).toThrow()
  })

  it('bound every string, a Preview in UTF-16 units far above the 350 characters Mapping counts', () => {
    expect(decodes({ _tag: 'EditTile', id: t })).toBe(true)
    expect(decodes({ _tag: 'EditTile', id: t, body: 'x'.repeat(100_000) })).toBe(true)
    expect(decodes({ _tag: 'EditTile', id: t, body: 'x'.repeat(100_001) })).toBe(false)
    expect(decodes({ _tag: 'EditTile', id: t, preview: 'x'.repeat(8_000) })).toBe(true)
    expect(decodes({ _tag: 'EditTile', id: t, preview: 'x'.repeat(8_001) })).toBe(false)
    const titled = (title: string) => ({
      _tag: 'CreateTile',
      parent: p,
      slot: 1,
      ...content,
      title,
    })
    expect(decodes(titled('x'.repeat(1_000)))).toBe(true)
    expect(decodes(titled('x'.repeat(1_001)))).toBe(false)
  })

  it('take an id on a create, which the caller may leave out', () => {
    expect(new CreateTile({ parent: p, slot: 1, ...content })).not.toHaveProperty('id')
    expect(new CreateTile({ id: t, parent: p, slot: 1, ...content })).toMatchObject({ id: t })
  })

  it('refuse a tag no Operation has, and a read', () => {
    expect(decodes({ _tag: 'ReadTile', id: t })).toBe(false)
    expect(decodes({ id: t })).toBe(false)
  })

  it('name each Operation as the service, its server function and its MCP write do', () => {
    expectTypeOf<OperationName>().toEqualTypeOf<
      | 'createTile'
      | 'editTile'
      | 'moveTile'
      | 'swapTiles'
      | 'deleteTile'
      | 'createReference'
      | 'deleteReference'
    >()
  })
})
