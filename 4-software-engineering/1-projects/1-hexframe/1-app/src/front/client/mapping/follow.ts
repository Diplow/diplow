// Following the System: the page polls its Version, the smallest read there is, and reads the System
// again only once the Version moved past the one the cache holds, so a write the page did not make,
// an agent's, a Key's or another tab's, shows on it. It polls when the tab regains focus, and every
// 2 s while the page follows closely, as it will while a Turn runs. The pending writes stay folded over
// whatever the read brings (`./queries.ts`, `useSystem`).
import { type QueryClient, useQuery, useQueryClient } from '@tanstack/react-query'

import { systemVersion } from '#/api/mapping/mapping'

import { read } from '../calls'
import { systemRead } from './queries'

/** How often a page following closely polls the System's Version, in milliseconds. */
const closelyEvery = 2_000

/**
 * The System's Version, read alone: a frame read, whose failure is reported and shows nothing; its
 * call, apart, which `polled` makes and follows.
 */
const { queryFn: askVersion, ...versionRead } = read({
  scope: 'systemVersion',
  key: [],
  call: () => systemVersion({ data: undefined }),
  frame: true,
})

/**
 * Polls the System's Version, then reads the System again when it moved past the one the cache holds,
 * a read already on its way left to land. Nothing is read again before the System's first read.
 */
async function polled(
  client: QueryClient,
  context: Parameters<NonNullable<typeof askVersion>>[0],
): Promise<number> {
  // `read` always builds one: its type only leaves it optional.
  if (askVersion === undefined) throw new Error('The Version’s read has no call')
  const version = await askVersion(context)
  const held = client.getQueryData(systemRead.queryKey)
  if (held !== undefined && version > held.version) {
    void client.invalidateQueries({ queryKey: systemRead.queryKey }, { cancelRefetch: false })
  }
  return version
}

/**
 * Has the page follow the System: its Version polled when the tab regains focus, and every 2 s while
 * `closely` says to, the System read again each time it moved. Nothing drives `closely` yet: a Turn
 * will, while it runs.
 */
export function useFollowSystem({ closely }: { closely: boolean }) {
  const client = useQueryClient()
  useQuery({
    ...versionRead,
    queryFn: (context) => polled(client, context),
    refetchOnWindowFocus: 'always',
    refetchInterval: closely ? closelyEvery : false,
  })
}
