import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { anchorOf, pieces, tiers, usedIn } from './pieces'

/** The pieces drawn in files of their own: every entry but the crossings, which join two ends. */
const drawn = pieces.filter((piece) => 'sources' in piece)

// `src/front/`, which every source is written from.
const front = fileURLToPath(new URL('../../', import.meta.url))

interface Import {
  file: string
  /** The names it imports, none for a side effect or a default import. */
  names: string[]
}

const importLine = /^import\s+(type\s+)?([\s\S]*?)\s*from\s+'([^']+)'/gm

/** A specifier as a file under `src/front/`, or nothing for a package, another layer or a stylesheet. */
function resolved(from: string, specifier: string): string | undefined {
  const path = specifier.split('?')[0] ?? ''
  const base = path.startsWith('#/front/')
    ? join(front, path.slice('#/front/'.length))
    : path.startsWith('.')
      ? resolve(dirname(from), path)
      : undefined
  if (base === undefined) return undefined
  return ['.ts', '.tsx', '', '/index.ts']
    .map((ending) => base + ending)
    .find((file) => existsSync(file) && statSync(file).isFile() && /\.tsx?$/.test(file))
}

/** What a file imports for its values: a type-only import draws nothing. */
function importsOf(file: string): Import[] {
  const code = readFileSync(file, 'utf8')
  return Array.from(code.matchAll(importLine)).flatMap(
    ([, typeOnly, clause = '', specifier = '']) => {
      if (typeOnly) return []
      const target = resolved(file, specifier)
      if (target === undefined) return []
      const named = /\{([^}]*)\}/.exec(clause)?.[1] ?? ''
      const names = named
        .split(',')
        .map((name) => name.trim())
        .filter((name) => name !== '' && !name.startsWith('type '))
        .map((name) => name.split(/\s+as\s+/)[0] ?? name)
      if (named !== '' && names.length === 0) return []
      return [{ file: target, names }]
    },
  )
}

const piecesIn = new Map<string, string[]>()
for (const piece of drawn) {
  for (const source of piece.sources) {
    const file = join(front, source)
    piecesIn.set(file, [...(piecesIn.get(file) ?? []), piece.name])
  }
}

/** The pieces an import draws in: a file holding several gives those it names, one holding one gives it. */
function piecesOf({ file, names }: Import): string[] {
  const there = piecesIn.get(file) ?? []
  return there.length === 1 ? there : there.filter((piece) => names.includes(piece))
}

/** The pieces a piece's files reach, through the files that are no piece of their own. */
function reached(sources: readonly string[]): string[] {
  const own = new Set(sources.map((source) => join(front, source)))
  const seen = new Set(own)
  const found = new Set<string>()
  const queue = [...own]
  for (let file = queue.shift(); file !== undefined; file = queue.shift()) {
    for (const imported of importsOf(file)) {
      if (own.has(imported.file) || seen.has(imported.file)) continue
      if (piecesIn.has(imported.file)) {
        for (const piece of piecesOf(imported)) found.add(piece)
      } else {
        seen.add(imported.file)
        queue.push(imported.file)
      }
    }
  }
  return drawn.map(({ name }) => name).filter((name) => found.has(name))
}

/** The pieces drawn from these files, there or inside a piece drawn there, all the way down. */
function drawnFrom(sources: readonly string[]): Set<string> {
  const found = new Set<string>()
  const queue = reached(sources)
  for (let name = queue.shift(); name !== undefined; name = queue.shift()) {
    if (found.has(name)) continue
    found.add(name)
    queue.push(...reached(drawn.find((piece) => piece.name === name)?.sources ?? []))
  }
  return found
}

describe('the pieces', () => {
  it.each(drawn.map((piece) => [piece.name, piece] as const))(
    '%s is drawn in files that exist',
    (_, { sources }) => {
      for (const source of sources) expect(existsSync(join(front, source)), source).toBe(true)
    },
  )

  it.each(drawn.map((piece) => [piece.name, piece] as const))(
    '%s is made of what its files import',
    (_, { sources, madeOf }) => {
      expect(
        madeOf.filter((part) => !reached(sources).includes(part)),
        'not imported',
      ).toEqual([])
    },
  )

  // A piece alone in its files names all they import; pieces sharing a file share its imports.
  it.each(Array.from(new Set(drawn.map(({ sources }) => sources.join()))))(
    'what %s imports is a part of the pieces drawn in it',
    (files) => {
      const sharing = drawn.filter(({ sources }) => sources.join() === files)
      const named = new Set(sharing.flatMap(({ madeOf }) => madeOf as readonly string[]))
      expect(reached(sharing[0]?.sources ?? []).filter((part) => !named.has(part))).toEqual([])
    },
  )

  it('have one name each, so each has one anchor', () => {
    const names = pieces.map(({ name }) => anchorOf(name))
    expect(new Set(names).size).toBe(names.length)
  })

  it('come in the order of their tiers, top-down', () => {
    const order = pieces.map(({ tier }) => tiers.indexOf(tier))
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  it('read "used in" back from "made of"', () => {
    expect(usedIn('Button')).toContain('ConfirmDialog')
    expect(usedIn('Conversation')).toEqual([])
  })

  it('fill every tier, the crossings last, by their proposal (HEX-108)', () => {
    const empty = tiers.filter((tier) => !pieces.some((piece) => piece.tier === tier))
    expect(empty).toEqual([])
  })
})

describe('the crossings', () => {
  const crossings = pieces.filter((piece) => 'ends' in piece)
  const tierOf = new Map<string, string>(pieces.map(({ name, tier }) => [name, tier]))

  it.each(crossings.map((crossing) => [crossing.name, crossing] as const))(
    '%s joins an end on each side, a piece of the Chat and a piece of the Canvas',
    (_, { ends }) => {
      expect(ends.chat.some((part) => tierOf.get(part) === 'chat')).toBe(true)
      expect(ends.canvas.some((part) => tierOf.get(part) === 'canvas')).toBe(true)
    },
  )

  it.each(crossings.map((crossing) => [crossing.name, crossing] as const))(
    "%s joins pieces of the catalogue, none of the other side's at its end",
    (_, { ends }) => {
      const other = { chat: 'canvas', canvas: 'chat' } as const
      for (const side of ['chat', 'canvas'] as const) {
        for (const part of ends[side]) {
          expect(tierOf.get(part), part).toBeDefined()
          expect(tierOf.get(part), part).not.toBe(other[side])
        }
      }
    },
  )

  // Each side's crossings are drawn in its own file; the page's, which joins them, lays out what holds
  // both, the phone's Screen. An end names what they draw, so a piece no crossing draws is caught.
  const joining = importsOf(join(front, 'ui/crossings.tsx')).flatMap(piecesOf)
  const drawnAt = {
    chat: [...drawnFrom(['ui/chat/crossings.tsx']), ...joining],
    canvas: [...drawnFrom(['ui/canvas/crossings.tsx']), ...joining],
  }

  it.each(crossings.map((crossing) => [crossing.name, crossing] as const))(
    '%s names at each end pieces its side draws',
    (_, { ends }) => {
      for (const side of ['chat', 'canvas'] as const) {
        for (const part of ends[side]) expect(drawnAt[side], part).toContain(part)
      }
    },
  )

  it('read "used in" back from their ends', () => {
    expect(usedIn('Mention')).toContain('Pointing')
    expect(usedIn('Canvas')).toContain('NavigationEntry')
  })
})
