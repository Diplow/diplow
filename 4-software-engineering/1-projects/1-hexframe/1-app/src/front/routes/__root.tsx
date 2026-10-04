import { HeadContent, Link, Scripts, createRootRoute, useMatches } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { provedSession } from '#/front/client/iam/guard'
import { m } from '#/paraglide/messages'
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
          <SignedInLinks />
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

/**
 * The links a signed-in Account has, to its System and its Keys. A page's guard, `signedInOnly`, puts
 * the Session on its route's context: a page that proved one shows them, others show none, with no
 * call of their own.
 */
function SignedInLinks() {
  const signedIn = useMatches({
    select: (matches) => matches.some((match) => provedSession(match.context)),
  })
  if (!signedIn) return null
  const link =
    'rounded-md px-3 py-2 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[status=active]:text-foreground'
  return (
    <nav aria-label={m.nav_label()} className="mr-auto flex items-center gap-1">
      <Link to="/" activeOptions={{ exact: true, includeSearch: false }} className={link}>
        {m.nav_system()}
      </Link>
      <Link to="/settings/keys" className={link}>
        {m.nav_keys()}
      </Link>
    </nav>
  )
}
