// Where the user went, sent to the Conversation: each gesture the canvas makes, published as a
// navigation fact, merges into the navigation under way by Assistant's merge rule, kept in the page
// and sent once something else enters the timeline, a Message or a write to the System, or once the
// page is hidden or home is left: one request per merged navigation, never one per gesture. A Message
// goes after the navigation it follows, in the Conversation's queue. Nothing of it is rendered: the navigation under
// way is an outbox, held between gestures, never shown, so it waits in a ref rather than in state.
import { useCallback, useRef, useSyncExternalStore } from 'react'

import { merged, type Navigation, within } from '#/domains/assistant/entities'
import { usePostMessage, useRecordNavigation } from '#/front/client/assistant/conversation'
import { useEachSystemWrite } from '#/front/client/mapping/queries'

import { useFact } from '../../bus'
import { Navigated } from '../../facts'

/** The navigation under way: the gestures merged so far, and when the last was made. */
interface UnderWay {
  readonly navigation: Navigation
  readonly lastAt: number
}

const nothing = () => undefined

/**
 * Merges the user's navigations as they go, and sends them as one Entry before anything else enters
 * the timeline, when the page is hidden, or when the hook unmounts. Answers `postMessage`, which posts the user's Message
 * after the navigation it follows. Its actions are stable, so it subscribes once.
 */
export function useNavigationSender(): { readonly postMessage: (text: string) => void } {
  const { mutate: record } = useRecordNavigation()
  const { mutate: post } = usePostMessage()
  const underWay = useRef<UnderWay | undefined>(undefined)

  /** Sends the navigation under way, if any, dated by how long ago its last gesture was. */
  const send = useCallback(() => {
    const held = underWay.current
    if (held === undefined) return
    underWay.current = undefined
    // A day at most, as the server takes it: a tab left open longer dates it back a day.
    const sinceLast = within(Date.now() - held.lastAt)
    record({ navigation: held.navigation, sinceLast })
  }, [record])

  const navigated = useCallback(({ gesture, tile }: Navigated) => {
    underWay.current = {
      navigation: merged(underWay.current?.navigation, { gesture, tile }),
      lastAt: Date.now(),
    }
  }, [])
  useFact(Navigated, navigated)
  useEachSystemWrite(send)

  // The page hidden, its tab left or about to close, is the last moment to send it; leaving home,
  // which unmounts the hook, sends it too. A tab closing may still drop the request on its way, or
  // before it starts, queued behind another write of the Conversation: a lost navigation is accepted,
  // as a lost event on the bus is.
  const subscribe = useCallback(() => {
    const onChange = () => {
      if (document.visibilityState === 'hidden') send()
    }
    document.addEventListener('visibilitychange', onChange)
    return () => {
      document.removeEventListener('visibilitychange', onChange)
      send()
    }
  }, [send])
  useSyncExternalStore(subscribe, nothing, nothing)

  const postMessage = useCallback(
    (text: string) => {
      send()
      post(text)
    },
    [send, post],
  )
  return { postMessage }
}
