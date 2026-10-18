// `/keys`, the composer's: the key widget opened at the conversation's foot, home's search param set
// as `search.ts` names it, the chat brought to the front on a phone. Out of home's route, which
// stood at its 600 lines (`hexframe-app-sharing-organizations/decisions.md#DEC-13`).
import { useRouter } from '@tanstack/react-router'

import { withKeys } from './search'

/**
 * Opens the key widget on home, the rest of its search params kept, then brings the chat to the
 * front, as `turning` turns the screen on a phone.
 */
export function useOpenKeys(turning: { readonly turn: (front: 'chat') => void }) {
  const router = useRouter()
  return () => {
    void router.navigate({ to: '/', search: (current) => ({ ...current, ...withKeys(true) }) })
    turning.turn('chat')
  }
}
