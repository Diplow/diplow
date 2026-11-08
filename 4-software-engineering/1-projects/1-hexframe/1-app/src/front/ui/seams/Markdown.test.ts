import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { Markdown } from './Markdown'

// What a Body may not do once rendered, whoever wrote it: run code, or fetch from a host of its own.

const rendered = (text: string) => renderToStaticMarkup(createElement(Markdown, { text }))

describe('Markdown', () => {
  it('shows HTML as text, never as an element', () => {
    const html = rendered(
      '<img src=x onerror="alert(1)">\n\n<script>alert(1)</script>\n\nA <b>word</b>',
    )
    expect(html).not.toMatch(/<(img|script|b)\b/)
    expect(html).toContain('&lt;script&gt;')
  })

  it('drops a link that would run code, keeping its words', () => {
    const html = rendered('[here](javascript:alert(1)) and [there](JaVaScRiPt:alert(1))')
    expect(html).not.toMatch(/javascript:/i)
    expect(html).toContain('here')
  })

  it('keeps a link to a page', () => {
    expect(rendered('[hexframe](https://hexframe.ai)')).toContain('href="https://hexframe.ai"')
  })

  it('fetches no image, its alt text shown in its place', () => {
    const html = rendered('![a map](https://elsewhere.example/pixel.png) ![here](/pixel.png)')
    expect(html).not.toMatch(/<img\b/)
    expect(html).toContain('a map')
  })
})
