// The theme's colour tokens, read from `styles.css` itself, so /dev/ui never lists one the theme lacks
// nor misses one it has.

/** A colour token, by the name of its variable (`--success`) and utilities (`bg-success`), with the foreground meant to sit on it. */
export interface ColorToken {
  name: string
  foreground?: string
}

/** The body of the stylesheet's `@theme inline` block, up to the brace that closes it, nested blocks included. */
function themeBlock(css: string): string {
  const start = css.indexOf('@theme inline {')
  if (start === -1) return ''
  const open = start + '@theme inline {'.length
  let depth = 1
  for (let at = open; at < css.length; at++) {
    if (css[at] === '{') depth++
    if (css[at] === '}' && --depth === 0) return css.slice(open, at)
  }
  return css.slice(open)
}

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
