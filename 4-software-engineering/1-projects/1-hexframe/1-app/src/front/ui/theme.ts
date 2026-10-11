import { useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

const storageKey = 'hexframe.theme'

/**
 * Inlined in `<head>`, it applies the theme before the first paint so a dark page never flashes light:
 * dark, the design system's default, unless the user chose light with the toggle. The system's
 * preference is not a choice made here, so it doesn't count. From then on, the class on `<html>` is
 * the one source of truth.
 */
export const themeScript = `try{var t=null;try{t=localStorage.getItem('${storageKey}')}catch(e){}if(t!=='light')document.documentElement.classList.add('dark')}catch(e){}`

const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function currentTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

// The server cannot know the visitor's choice; hydration starts from the default and re-renders at once.
function serverTheme(): Theme {
  return 'dark'
}

function setTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  try {
    localStorage.setItem(storageKey, theme)
  } catch {
    // Storage is blocked: the theme still applies, it just won't outlive the page.
  }
  listeners.forEach((listener) => {
    listener()
  })
}

export function useThemeState() {
  const theme = useSyncExternalStore(subscribe, currentTheme, serverTheme)
  return {
    state: { theme },
    actions: {
      toggle: () => {
        setTheme(theme === 'dark' ? 'light' : 'dark')
      },
    },
  }
}
