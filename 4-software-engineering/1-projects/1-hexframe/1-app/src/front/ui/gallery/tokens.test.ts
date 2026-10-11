import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { colourNotes, valueNotes, type Note } from './Tokens'
import { colorTokens, valueTokens } from './stylesheet'

// Read from disk: Vitest stubs CSS imports, `?raw` included.
const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8')
const themes = { light: /^:root \{([^}]*)\}/m, dark: /^\.dark \{([^}]*)\}/m }

describe('colorTokens', () => {
  it('folds a foreground into its token and keeps a token without one alone', () => {
    const theme = `@theme inline {
      --color-muted: var(--muted);
      --color-muted-foreground: var(--muted-foreground);
      --color-border: var(--border);
      --radius-lg: var(--radius);
    }`
    expect(colorTokens(theme)).toEqual([
      { name: 'muted', foreground: 'muted-foreground' },
      { name: 'border' },
    ])
  })

  it('reads only the @theme inline block', () => {
    expect(colorTokens(':root { --color-stray: red; }')).toEqual([])
  })

  it('reads past a block nested inside it, up to the brace that closes it', () => {
    const theme = `@theme inline {
      --color-glow: var(--glow);
      @keyframes breathe { 50% { opacity: 0.35; } }
      --color-tile: var(--tile);
    }
    :root { --color-stray: red; }`
    expect(colorTokens(theme)).toEqual([{ name: 'glow' }, { name: 'tile' }])
  })
})

describe('the theme', () => {
  const tokens = colorTokens(css)

  it.each(['success', 'warning', 'info', 'destructive'])('has %s, with a foreground', (name) => {
    expect(tokens).toContainEqual({ name, foreground: `${name}-foreground` })
  })

  it.each([
    'faint',
    'human',
    'agent',
    'context',
    'glow',
    'glow-soft',
    'halo',
    'aura',
    'ambient',
    'tile',
    'tile-fade',
    'tile-lit',
    'tile-lit-fade',
  ])('has %s, which no text sits on, so without a foreground', (name) => {
    expect(tokens).toContainEqual({ name })
  })

  const variables = tokens.flatMap(({ name, foreground }) =>
    foreground ? [name, foreground] : [name],
  )

  // Each theme's variables, by name, with their value; a declaration left empty is not one.
  function declared(selector: RegExp) {
    const block = selector.exec(css)?.[1] ?? ''
    return new Map(
      Array.from(block.matchAll(/--([\w-]+):\s*([^;\s][^;]*);/g), ([, name = '', value = '']) => [
        name,
        value,
      ]),
    )
  }

  it('reads every colour the stylesheet declares in @theme inline', () => {
    const declared = Array.from(css.matchAll(/--color-([\w-]+):/g), ([, name = '']) => name)
    expect(declared.filter((name) => !variables.includes(name))).toEqual([])
  })

  it('gives every colour token a value in light and in dark', () => {
    for (const [theme, selector] of Object.entries(themes)) {
      const values = declared(selector)
      expect(
        variables.filter((name) => !values.has(name)),
        theme,
      ).toEqual([])
    }
  })

  it('lists every colour the themes declare, so /design-system misses none', () => {
    for (const [theme, selector] of Object.entries(themes)) {
      const colours = [...declared(selector)].filter(([, value]) => value.startsWith('oklch('))
      const unlisted = colours.map(([name]) => name).filter((name) => !variables.includes(name))
      expect(unlisted, theme).toEqual([])
    }
  })
})

describe('valueTokens', () => {
  it("reads the theme beside its colours, a line height aside, then the base layer's :root", () => {
    const sheet = `@theme inline {
      --color-glow: var(--glow);
      --font-sans: 'Geist Variable', sans-serif;
      --text-prose: 1.125rem;
      --text-prose--line-height: 1.55;
      @keyframes breathe { 50% { opacity: 0.35; } }
      --animate-breathe: breathe 3.2s ease-in-out infinite;
    }
    @layer base {
      * { color: red; }
      :root { --duration-turn: 600ms; }
    }`
    expect(valueTokens(sheet)).toEqual([
      { name: 'font-sans', value: "'Geist Variable', sans-serif" },
      { name: 'text-prose', value: '1.125rem' },
      { name: 'animate-breathe', value: 'breathe 3.2s ease-in-out infinite' },
      { name: 'duration-turn', value: '600ms' },
    ])
  })
})

describe('the notes', () => {
  // Each token under exactly one note, and each note's tokens in the stylesheet.
  function fits(notes: readonly Note[], names: string[]) {
    const noted = notes.flatMap(({ tokens }) => tokens)
    expect(
      names.filter((name) => !noted.includes(name)),
      'unnoted',
    ).toEqual([])
    expect(
      noted.filter((name) => !names.includes(name)),
      'not in the stylesheet',
    ).toEqual([])
    expect(new Set(noted).size, 'noted twice').toBe(noted.length)
  }

  it('say what every colour token is for', () => {
    fits(
      colourNotes,
      colorTokens(css).map(({ name }) => name),
    )
  })

  it('say what every other token is for: the type, the shape, the motion', () => {
    fits(
      valueNotes,
      valueTokens(css).map(({ name }) => name),
    )
  })
})
