import { useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

const storageKey = 'hexframe.theme'

/**
 * Inlined in `<head>`, it applies the theme before the first paint so a dark page never flashes light:
 * the stored choice if there is one, the system's preference otherwise. From then on, the class on
 * `<html>` is the one source of truth.
 */
export const themeScript = `try{var t=null;try{t=localStorage.getItem('${storageKey}')}catch(e){}if(t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`

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

// The server cannot know the visitor's theme; hydration starts from light and re-renders at once.
function serverTheme(): Theme {
  return 'light'
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
