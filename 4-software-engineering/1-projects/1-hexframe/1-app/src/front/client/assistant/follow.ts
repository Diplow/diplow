// Following what home shows: the page polls one small read, the System's Version, the Entry last
// recorded in the Conversation, the Turn running, the Mode and the open Proposal (`latest`), and reads
// the System again only once its Version moved past the one the cache holds, and the Conversation once
// its last Entry or its Proposal is another than the one the cache read with it. So a change the page did not make, an agent's, a Key's or
// another tab's, shows on the canvas and in the timeline. It polls when the tab regains focus, and
// every 2 s while a Turn runs, hidden or not, so the page follows its agent's steps and writes. The
// pending writes stay folded over whatever the System's read brings (`../mapping/queries.ts`,
// `useSystem`).
import { type QueryClient, type QueryKey, useQuery, useQueryClient } from '@tanstack/react-query'

import { settle } from '../calls'
import { systemRead, useEachSystemWrite } from '../mapping/queries'
import { askLatest, conversationRead, latestRead, latestScope } from './conversation'

/** How often a page polls while a Turn runs, in milliseconds. */
const closelyEvery = 2_000

/** What the poll answers. */
type Latest = Extract<Awaited<ReturnType<typeof askLatest>>, { ok: true }>['value']

/** The open Proposal as the poll and a day of the Conversation say it, its id and its writes. */
type ProposalNow = Latest['proposal']

/** Whether two reads say the same open Proposal, holding as many writes, or both none. */
const sameProposal = (a: ProposalNow, b: ProposalNow) => a?.id === b?.id && a?.drafts === b?.drafts

/**
 * Whether the System the cache holds is behind the Version polled, and the Conversation it holds
 * behind its last Entry or its open Proposal, a write drafted into it since: neither before its first
 * read.
 */
const behind = {
  system: (client: QueryClient, { version }: Latest) => {
    const held = client.getQueryData(systemRead.queryKey)
    return held !== undefined && version > held.version
  },
  conversation: (client: QueryClient, { lastEntry, proposal }: Latest) => {
    const held = client.getQueryData(conversationRead.queryKey)?.pages[0]
    if (held === undefined) return false
    return lastEntry !== held.lastEntry || !sameProposal(proposal, held.proposal)
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

/** The Turn running, as the poll last saw it: its id, and its agent's step now, if any. */
export type LiveTurn = NonNullable<Latest['turn']>

/**
 * Has the page follow the System and the Conversation: the latest of both polled when the tab regains
 * focus, every 2 s while a Turn runs, and once each write to the System the page made has settled,
 * since the server recorded it in the Conversation as it committed; each read again once it moved.
 * Answers the Turn running and the Conversation's Mode, as the poll last saw them, neither before its
 * first answer.
 */
export function useFollowLatest(): {
  readonly turn: LiveTurn | undefined
  readonly mode: Latest['mode'] | undefined
} {
  const client = useQueryClient()
  useEachSystemWrite(() => {
    void client.refetchQueries({ queryKey: latestRead.queryKey })
  }, 'settled')
  const { data } = useQuery({
    ...latestRead,
    queryFn: () => polled(client),
    refetchOnWindowFocus: 'always',
    refetchInterval: (query) => (query.state.data?.turn === undefined ? false : closelyEvery),
    // A Turn lasts 15 minutes at most: its page keeps up with it behind another window too.
    refetchIntervalInBackground: true,
  })
  return { turn: data?.turn, mode: data?.mode }
}
