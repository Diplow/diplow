import { useLocation } from '@tanstack/react-router'

import { m } from '#/paraglide/messages'
import { getLocale, localizeHref, locales } from '#/paraglide/runtime'

import { Button } from './button'

// A plain link and a full page load: every message on the page, server-rendered ones included, switches at once.
export function LocaleSwitch() {
  const href = useLocation({ select: (location) => location.href })
  const current = getLocale()
  return (
    <nav aria-label={m.locale_switch_label()} className="flex gap-1">
      {locales.map((locale) => (
        <Button key={locale} asChild size="sm" variant={locale === current ? 'secondary' : 'ghost'}>
          <a
            href={localizeHref(href, { locale })}
            hrefLang={locale}
            aria-current={locale === current}
          >
            {locale.toUpperCase()}
          </a>
        </Button>
      ))}
    </nav>
  )
}
