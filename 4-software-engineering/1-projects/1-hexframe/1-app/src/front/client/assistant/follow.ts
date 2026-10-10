// Following what home shows: the page polls one small read, the System's Version and the Entry last
// recorded in the Conversation (`latest`), and reads the System again only once its Version moved
// past the one the cache holds, and the Conversation once its last Entry is another than the one the
// cache read with it. So a change the page did not make, an agent's, a Key's or another tab's, shows on
// the canvas and in the timeline. It polls when the tab regains focus, and every 2 s while the page
// follows closely, as it will while a Turn runs. The pending writes stay folded over whatever the
// System's read brings (`../mapping/queries.ts`, `useSystem`).
import { type QueryClient, type QueryKey, useQuery, useQueryClient } from '@tanstack/react-query'

import { latest } from '#/api/assistant/assistant'

import { read, settle } from '../calls'
import { systemRead, useEachSystemWrite } from '../mapping/queries'
import { conversationRead } from './conversation'

/** How often a page following closely polls, in milliseconds. */
const closelyEvery = 2_000

/** The poll's read, by the server function's name. */
const latestScope = 'latest'

/** The System's Version and the Conversation's last Entry, asked of their server function. */
const askLatest = () => latest({ data: undefined })

/** The poll, read alone: a frame read, whose failure is reported and shows nothing. */
const latestRead = read({ scope: latestScope, key: [], call: askLatest, frame: true })

/** What the poll answers. */
type Latest = Extract<Awaited<ReturnType<typeof askLatest>>, { ok: true }>['value']

/**
 * Whether the System the cache holds is behind the Version polled, and the Conversation it holds
 * behind its last Entry: neither before its first read.
 */
const behind = {
  system: (client: QueryClient, { version }: Latest) => {
    const held = client.getQueryData(systemRead.queryKey)
    return held !== undefined && version > held.version
  },
  conversation: (client: QueryClient, { last }: Latest) => {
    const held = client.getQueryData(conversationRead.queryKey)?.pages[0]
    return held !== undefined && last !== held.last
  },
}

/**
 * Reads a query again while the cache is behind what was polled: a read already on its way is left to
 * land, and, should it have started before the poll's answer, one more is made once it has.
 */
async function caughtUp(client: QueryClient, queryKey: QueryKey, stillBehind: () => boolean) {
  for (let reads = 0; reads < 2 && stillBehind(); reads++) {
    await client.invalidateQueries({ queryKey }, { cancelRefetch: false })
  }
}

/** Polls the latest, then reads again, side by side, whatever the cache holds behind it. */
async function polled(client: QueryClient): Promise<Latest> {
  const now = await settle(latestScope, askLatest())
  await Promise.all([
    caughtUp(client, systemRead.queryKey, () => behind.system(client, now)),
    caughtUp(client, conversationRead.queryKey, () => behind.conversation(client, now)),
  ])
  return now
}

/**
 * Has the page follow the System and the Conversation: the latest of both polled when the tab regains
 * focus, every 2 s while `closely` says to, and once each write to the System the page made has
 * settled, since the server recorded it in the Conversation as it committed; each read again once it
 * moved. Nothing drives `closely` yet: a Turn will, while it runs.
 */
export function useFollowLatest({ closely }: { closely: boolean }) {
  const client = useQueryClient()
  useEachSystemWrite(() => {
    void client.refetchQueries({ queryKey: latestRead.queryKey })
  }, 'settled')
  useQuery({
    ...latestRead,
    queryFn: () => polled(client),
    refetchOnWindowFocus: 'always',
    refetchInterval: closely ? closelyEvery : false,
  })
}
