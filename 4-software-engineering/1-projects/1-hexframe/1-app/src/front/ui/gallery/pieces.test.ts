import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { anchorOf, filled, pieces, tiers, usedIn } from './pieces'

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
for (const piece of pieces) {
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
  return pieces.map(({ name }) => name).filter((name) => found.has(name))
}

describe('the pieces', () => {
  it.each(pieces.map((piece) => [piece.name, piece] as const))(
    '%s is drawn in files that exist',
    (_, { sources }) => {
      for (const source of sources) expect(existsSync(join(front, source)), source).toBe(true)
    },
  )

  it.each(pieces.map((piece) => [piece.name, piece] as const))(
    '%s is made of what its files import',
    (_, { sources, madeOf }) => {
      expect([...madeOf]).toEqual(reached(sources))
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

  it('leave a tier hidden while no piece fills it: the crossings, until the first is built', () => {
    expect(filled('crossings')).toBe(false)
    expect(filled('atoms')).toBe(true)
  })
})
