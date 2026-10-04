import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { getLocale } from '#/paraglide/runtime'
import { Toaster } from '#/front/ui/feedback/Toaster'
import { LocaleSwitch } from '#/front/ui/inputs/controls/LocaleSwitch'
import { ThemeToggle } from '#/front/ui/inputs/controls/ThemeToggle'
import { themeScript } from '#/front/ui/theme'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'hexframe' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    // The theme script sets `<html>`'s class before React hydrates, hence the warning suppressed.
    <html lang={getLocale()} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <HeadContent />
      </head>
      <body>
        <header className="flex items-center justify-end gap-2 p-4">
          <LocaleSwitch />
          <ThemeToggle />
        </header>
        {children}
        <Toaster />
        <Scripts />
      </body>
    </html>
  )
}
