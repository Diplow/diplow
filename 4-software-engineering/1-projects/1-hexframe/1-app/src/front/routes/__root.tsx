import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { getLocale } from '#/paraglide/runtime'
import { Toaster } from '#/front/ui/atoms/Toaster'
import { themeScript } from '#/front/ui/theme'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'hexframe' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
    ],
  }),
  shellComponent: RootDocument,
})

/**
 * The document, with no header: hexframe is one screen, and what a header's links did the composer's
 * commands do, `/help` and `/keys` among them.
 */
function RootDocument({ children }: { children: ReactNode }) {
  return (
    // The theme script sets `<html>`'s class before React hydrates, hence the warning suppressed.
    <html lang={getLocale()} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Toaster />
        <Scripts />
      </body>
    </html>
  )
}
