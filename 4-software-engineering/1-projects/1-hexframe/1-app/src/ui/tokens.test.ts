import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { colorTokens } from './tokens'

// Read from disk: Vitest stubs CSS imports, `?raw` included.
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8')
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
})

describe('the theme', () => {
  const tokens = colorTokens(css)

  it.each(['brand', 'success', 'warning', 'info', 'destructive'])(
    'has %s, with a foreground',
    (name) => {
      expect(tokens).toContainEqual({ name, foreground: `${name}-foreground` })
    },
  )

  it('gives every colour token a value in light and in dark', () => {
    const variables = tokens.flatMap(({ name, foreground }) =>
      foreground ? [name, foreground] : [name],
    )
    for (const [theme, selector] of Object.entries(themes)) {
      const block = selector.exec(css)?.[1] ?? ''
      const declared = new Set(Array.from(block.matchAll(/--([\w-]+):/g), ([, name]) => name))
      const missing = variables.filter((name) => !declared.has(name))
      expect(missing, theme).toEqual([])
    }
  })
})
