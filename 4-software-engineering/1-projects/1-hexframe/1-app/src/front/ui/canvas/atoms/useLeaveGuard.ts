// Asks before the user leaves the page while something is still on its way: closing or reloading the
// tab, or typing another address, gets the browser's own prompt. The browser words it, not the app.
import { useEffect } from 'react'

/** While `active`, leaving the page asks first; once it is not, the page goes without asking. */
export function useLeaveGuard(active: boolean) {
  useEffect(() => {
    if (!active) return undefined
    const ask = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', ask)
    return () => {
      window.removeEventListener('beforeunload', ask)
    }
  }, [active])
}
