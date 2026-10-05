import { describe, expect, it } from 'vitest'

import { isExcluded, settingsFolder } from '../../../../../2-claude-mod/hooks/shape/exclusions'
import { bodyFiles, membersOf, sortEntries } from '../../../../../2-claude-mod/hooks/shape/node'
import { defaultNaming } from '../kept/naming'
import { type ToName, isVerbatim, namesIn, ownFileName, shapeNames, slugOf } from './names'

// How an export names what one folder holds, on entries made by hand: the slug of a Title, a kept
// Name dressed for its slot and renumbered, a bare name kept only where the shape would seat it again,
// and what the folder's own names and its siblings take.

describe('a slug', () => {
  it('is the Title lowercased, in `[a-z0-9-]`, accents transliterated, runs of the rest one `-`', () => {
    expect(slugOf('Software Engineering')).toBe('software-engineering')
    expect(slugOf('Éducation à la citoyenneté')).toBe('education-a-la-citoyennete')
    expect(slugOf('Cœur & Âme : l’œuvre')).toBe('coeur-ame-l-oeuvre')
    expect(slugOf('Straße, Øresund, Łódź')).toBe('strasse-oresund-lodz')
    expect(slugOf('  --a__b--  ')).toBe('a-b')
    expect(slugOf('v1.2 (draft)')).toBe('v1-2-draft')
  })

  it('decomposes a character before lowercasing it, so its letters survive', () => {
    expect(slugOf('\u210Cello \uFB01ne')).toBe('hello-fine')
  })

  it('is `tile` when nothing is left', () => {
    for (const title of ['', '..', '.', '---', '日本語', '🎲'])
      expect(slugOf(title), title).toBe('tile')
  })

  it('holds 48 characters at most, cut at a word boundary', () => {
    const words = 'the quick brown fox jumps over the lazy dog and keeps running far away'
    const slug = slugOf(words)
    expect(slug).toBe('the-quick-brown-fox-jumps-over-the-lazy-dog-and')
    expect(slug.length).toBeLessThanOrEqual(48)
    expect(slugOf('x'.repeat(60))).toBe('x'.repeat(48))
    expect(slugOf(`${'a'.repeat(48)} b`)).toBe('a'.repeat(48))
  })
})

describe('a Leaf written as its content alone', () => {
  it('is one an import of a file that isn’t Markdown made, untouched since', () => {
    expect(isVerbatim({ title: 'package.json', preview: '', name: 'package.json' })).toBe(true)
    expect(isVerbatim({ title: 'Makefile', preview: '', name: 'Makefile' })).toBe(true)
  })

  it('is no Markdown file, no dot file, nor one whose Title or Preview says more than its name', () => {
    expect(isVerbatim({ title: 'STACK.md', preview: '', name: 'STACK.md' })).toBe(false)
    expect(isVerbatim({ title: '.env', preview: '', name: '.env' })).toBe(false)
    expect(isVerbatim({ title: 'Build', preview: '', name: 'Makefile' })).toBe(false)
    expect(isVerbatim({ title: 'Makefile', preview: 'How it builds', name: 'Makefile' })).toBe(
      false,
    )
    expect(isVerbatim({ title: 'Makefile', preview: '' })).toBe(false)
  })
})

/** The names these entries export under. */
const names = (entries: ReadonlyArray<ToName>, naming = defaultNaming) =>
  namesIn(entries, naming).map(({ exportName }) => exportName)

describe('the names of a folder', () => {
  it('come from the folder pattern in force for a Tile without a Name', () => {
    expect(
      names([
        { kind: 'branch', direction: 3, title: 'Games' },
        { kind: 'context', direction: 1, title: 'Principles' },
        { kind: 'leaf', direction: 3, title: 'Rules of thumb' },
      ]),
    ).toEqual(['3-games', '.1-principles', '3-rules-of-thumb.md'])
    expect(
      names([{ kind: 'branch', direction: 1, title: 'Do ticket' }], {
        fileName: 'SKILL.md',
        folderPattern: 'skill-<slug>',
      }),
    ).toEqual(['skill-do-ticket'])
  })

  it('keep a numbered Name, in the Direction the Tile stands in now', () => {
    expect(
      names([
        { kind: 'branch', direction: 5, title: 'Games', name: '3-games' },
        { kind: 'context', direction: 2, title: 'Principles', name: '.4-principles' },
        { kind: 'leaf', direction: 1, title: 'Stack', name: '6-stack.md' },
      ]),
    ).toEqual(['5-games', '.2-principles', '1-stack.md'])
  })

  it('keep a bare Name where the shape would seat it again, and number it where it would not', () => {
    // The shape seats `alpha` in the first free Direction, 1, and `beta` in the next, 3.
    expect(
      names([
        { kind: 'branch', direction: 1, title: 'Alpha', name: 'alpha' },
        { kind: 'branch', direction: 2, title: 'Two', name: '2-two' },
        { kind: 'branch', direction: 3, title: 'Beta', name: 'beta' },
      ]),
    ).toEqual(['alpha', '2-two', 'beta'])
    // Swapped, each would come back in the other's Direction.
    expect(
      names([
        { kind: 'branch', direction: 3, title: 'Alpha', name: 'alpha' },
        { kind: 'branch', direction: 1, title: 'Beta', name: 'beta' },
      ]),
    ).toEqual(['3-alpha', '1-beta'])
    // Leaves and Context are seated among their own kind, apart from the Branches.
    expect(
      names([
        { kind: 'branch', direction: 1, title: 'Src', name: 'src' },
        { kind: 'leaf', direction: 1, title: 'STACK', name: 'STACK.md' },
        { kind: 'context', direction: 1, title: '.claude', name: '.claude' },
      ]),
    ).toEqual(['src', 'STACK.md', '.claude'])
  })

  it('dress a Name for the slot it stands in now: a folder, a dot folder, a Markdown file', () => {
    expect(
      names([
        { kind: 'branch', direction: 1, title: 'Claude', name: '.claude' },
        { kind: 'context', direction: 2, title: 'Games', name: '2-games' },
        { kind: 'leaf', direction: 3, title: 'Docs', name: '3-docs' },
        { kind: 'branch', direction: 4, title: 'Stack', name: '4-stack.md' },
      ]),
    ).toEqual(['claude', '.2-games', '3-docs.md', '4-stack'])
  })

  it('keep a Leaf that isn’t Markdown under its Name as it is, else write it as Markdown', () => {
    const json = {
      kind: 'leaf',
      title: 'package.json',
      name: 'package.json',
      verbatim: true,
    } as const
    expect(namesIn([{ ...json, direction: 1 }], defaultNaming)).toMatchObject([
      { exportName: 'package.json', verbatim: true },
    ])
    // Numbered, it would read back titled `4-package.json`: as Markdown, its Title survives.
    expect(namesIn([{ ...json, direction: 4 }], defaultNaming)).toMatchObject([
      { exportName: '4-package.json.md', verbatim: false },
    ])
  })

  it('number a bare name the folder’s own names or a sibling take, however it is cased', () => {
    expect(
      names([
        { kind: 'leaf', direction: 1, title: 'Claude', name: 'claude.md' },
        { kind: 'leaf', direction: 2, title: 'Private', name: '-CLAUDE.md' },
        { kind: 'branch', direction: 1, title: 'Modules', name: 'node_modules' },
        { kind: 'context', direction: 1, title: 'Settings', name: '.hexframe' },
      ]),
    ).toEqual(['1-claude.md', '2--CLAUDE.md', '1-node_modules', '.1-hexframe'])
    expect(
      names([{ kind: 'leaf', direction: 1, title: 'Skill', name: 'SKILL.md' }], {
        ...defaultNaming,
        fileName: 'SKILL.md',
      }),
    ).toEqual(['1-SKILL.md'])
    expect(
      names(
        [
          { kind: 'branch', direction: 1, title: 'Same' },
          { kind: 'branch', direction: 2, title: 'same' },
        ],
        { ...defaultNaming, folderPattern: '<slug>' },
      ),
    ).toEqual(['same', '2-same'])
  })

  it('number a Branch or a Leaf the pattern would name like a dot folder or a dot file', () => {
    expect(
      names(
        [
          { kind: 'branch', direction: 1, title: 'Foo' },
          { kind: 'leaf', direction: 1, title: 'Bar' },
        ],
        { ...defaultNaming, folderPattern: '.x-<slug>' },
      ),
    ).toEqual(['1-.x-foo', '1-.x-bar.md'])
  })

  it('give `tile` to a Title of `..` under a bare `<slug>` pattern, never `..`', () => {
    expect(
      names([{ kind: 'branch', direction: 1, title: '..' }], {
        ...defaultNaming,
        folderPattern: '<slug>',
      }),
    ).toEqual(['tile'])
  })

  it('throw, a defect, rather than write a name that is no path segment', () => {
    expect(() =>
      // Seated in Direction 1 by the shape, it takes its number, 2 bytes past a segment's 255.
      names([{ kind: 'branch', direction: 2, title: 'Long', name: 'x'.repeat(255) }]),
    ).toThrow(/cannot name/)
  })
})

describe('the name of a folder’s own file', () => {
  it('is the file name in force', () => {
    expect(ownFileName({ ...defaultNaming, fileName: 'SKILL.md' })).toBe('SKILL.md')
  })

  it('throws, a defect, on one that is no path segment or that the shape leaves out', () => {
    for (const fileName of ['..', 'a/b', '.hexframe', 'NODE_MODULES', '.git']) {
      expect(() => ownFileName({ ...defaultNaming, fileName }), fileName).toThrow(/cannot write/)
    }
  })
})

describe('the names of a folder, as the shape reads them', () => {
  it('reserve what the shape reads as a folder’s own or always leaves out, and only that', () => {
    for (const name of [...bodyFiles, settingsFolder]) expect(shapeNames).toContain(name)
    for (const name of shapeNames) {
      const own = (bodyFiles as ReadonlyArray<string>).includes(name)
      expect(own || isExcluded(name, true, []), name).toBe(true)
    }
  })

  it('land where the shape seats them, each kind read alone', () => {
    const folder: ReadonlyArray<ToName> = [
      { kind: 'branch', direction: 2, title: 'Alpha', name: 'alpha' },
      { kind: 'branch', direction: 1, title: 'Beta', name: 'beta' },
      { kind: 'branch', direction: 4, title: 'Games', name: '3-games' },
      { kind: 'branch', direction: 5, title: 'Zeta' },
      { kind: 'leaf', direction: 1, title: 'STACK', name: 'STACK.md' },
      { kind: 'leaf', direction: 3, title: 'Makefile', name: 'Makefile', verbatim: true },
      { kind: 'leaf', direction: 2, title: 'Notes' },
      { kind: 'context', direction: 1, title: '.claude', name: '.claude' },
      { kind: 'context', direction: 6, title: '.skills', name: '.skills' },
    ]
    const named = namesIn(folder, { ...defaultNaming, folderPattern: '<slug>' })
    const asShape = { branch: 'dir', context: 'dir', leaf: 'file' } as const
    for (const kind of ['branch', 'leaf', 'context'] as const) {
      const ofKind = named.filter((entry) => entry.kind === kind)
      const listing = ofKind.map(({ exportName }) => ({ name: exportName, kind: asShape[kind] }))
      const rings = sortEntries(listing)
      const members = membersOf(kind === 'context' ? rings.context : rings.children)
      for (const { exportName, direction } of ofKind) {
        expect(members[direction]?.name, exportName).toBe(exportName)
      }
    }
  })

  it('agree with the shape on the names it reads as a folder’s own, whatever the case', () => {
    const own = [...bodyFiles, settingsFolder]
    const entries = own.map((name, index) => ({
      kind: name.startsWith('.') ? ('context' as const) : ('leaf' as const),
      direction: (index + 1) as 1 | 2 | 3,
      title: name,
      name,
    }))
    for (const name of names(entries)) expect(own).not.toContain(name)
  })

  it('number a name the shape would misread, however it was made, keeping what it held', () => {
    // A slug that looks numbered, in another Direction than its number.
    expect(
      names([{ kind: 'branch', direction: 5, title: '3 Games' }], {
        ...defaultNaming,
        folderPattern: '<slug>',
      }),
    ).toEqual(['5-3-games'])
    // A folder and a file that isn't Markdown, of one name in one Direction: the folder keeps it,
    // and the file, renamed, is written as Markdown so its Title survives.
    expect(
      names([
        { kind: 'branch', direction: 3, title: 'X', name: '3-x' },
        { kind: 'leaf', direction: 3, title: '3-x', name: '3-x', verbatim: true },
      ]),
    ).toEqual(['3-x', '3-x.md'])
    // The file name a config sets, taken by a Leaf the pattern names.
    expect(
      names([{ kind: 'leaf', direction: 1, title: 'Intro' }], {
        ...defaultNaming,
        fileName: '1-intro.md',
      }),
    ).toEqual(['1-1-intro.md'])
  })
})
