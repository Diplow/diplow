// How many things were done on the page since it opened, for hexframe's mark to answer each: every
// write made, whatever it writes, a Message, a Tile, a navigation recorded, a Key, signing in, and
// every move of the page's address, a view, a widget, a form opened. Typing does nothing.
import { useQueryClient, type MutationCache } from '@tanstack/react-query'
import { useRouterState } from '@tanstack/react-router'
import { useState, useSyncExternalStore } from 'react'

/** The writes each cache has seen made, counted from the first time a page asked. */
const made = new WeakMap<MutationCache, { count: number }>()

function countOf(cache: MutationCache) {
  const known = made.get(cache)
  if (known !== undefined) return known
  const counted = { count: 0 }
  made.set(cache, counted)
  // Heard before any page's listener, which subscribes after it, so a page reads the count risen.
  cache.subscribe((event) => {
    if (event.type === 'added') counted.count += 1
  })
  return counted
}

/** Things done since the page opened: the writes made and the moves of its address. */
export function useThingsDone(): number {
  const cache = useQueryClient().getMutationCache()
  const counted = countOf(cache)
  const writes = useSyncExternalStore(
    (listener) => cache.subscribe(listener),
    () => counted.count,
    () => 0,
  )
  const href = useRouterState({ select: (state) => state.location.href })
  // Each move of the address counted once, as it renders, against the last one seen.
  const [moves, setMoves] = useState({ href, count: 0 })
  if (moves.href !== href) setMoves({ href, count: moves.count + 1 })
  return writes + moves.count
}
