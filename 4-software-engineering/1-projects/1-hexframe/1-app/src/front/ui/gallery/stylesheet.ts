// The theme's tokens, read from `styles.css` itself, so /design-system never lists one the theme lacks
// nor misses one it has: its colours, then its type, its shape and its motion.

/** A colour token, by the name of its variable (`--success`) and utilities (`bg-success`), with the foreground meant to sit on it. */
export interface ColorToken {
  name: string
  foreground?: string
}

/** Any other token, by its name without the dashes (`ease-glide`) and its value as written. */
export interface ValueToken {
  name: string
  value: string
}

/** The body of the first block `opener` opens, up to the brace that closes it, nested blocks included. */
function block(css: string, opener: string): string {
  const start = css.indexOf(opener)
  if (start === -1) return ''
  const open = start + opener.length
  let depth = 1
  for (let at = open; at < css.length; at++) {
    if (css[at] === '{') depth++
    if (css[at] === '}' && --depth === 0) return css.slice(open, at)
  }
  return css.slice(open)
}

const themeBlock = (css: string) => block(css, '@theme inline {')

/** Every `--color-*` in the stylesheet's `@theme inline` block, in order, each foreground folded into its token. */
export function colorTokens(css: string): ColorToken[] {
  const theme = themeBlock(css)
  const names = new Set(Array.from(theme.matchAll(/--color-([\w-]+):/g), ([, name = '']) => name))
  const tokens: ColorToken[] = []
  for (const name of names) {
    if (name.endsWith('-foreground') && names.has(name.slice(0, -'-foreground'.length))) continue
    const foreground = `${name}-foreground`
    tokens.push(names.has(foreground) ? { name, foreground } : { name })
  }
  return tokens
}

const declarations = /--([\w-]+):\s*([^;]+);/g

/**
 * Every other token: what `@theme inline` declares beside its colours (the fonts, the type sizes, the
 * radius scale, the easings, the animations), a size's line height aside, then the durations the
 * base layer declares on `:root`, which Tailwind makes no utility of.
 */
export function valueTokens(css: string): ValueToken[] {
  const theme = Array.from(themeBlock(css).matchAll(declarations)).filter(
    ([, name = '']) => !name.startsWith('color-') && !name.includes('--'),
  )
  const base = Array.from(block(block(css, '@layer base {'), ':root {').matchAll(declarations))
  return [...theme, ...base].map(([, name = '', value = '']) => ({ name, value: value.trim() }))
}
