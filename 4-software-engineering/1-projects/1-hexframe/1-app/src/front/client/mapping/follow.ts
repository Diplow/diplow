// Following the System: the page polls its Version, the smallest read there is, and reads the System
// again only once the Version moved past the one the cache holds, so a write the page did not make,
// an agent's, a Key's or another tab's, shows on it. It polls when the tab regains focus, and every
// 2 s while the page follows closely, as it will while a Turn runs. The pending writes stay folded over
// whatever the read brings (`./queries.ts`, `useSystem`).
import { type QueryClient, useQuery, useQueryClient } from '@tanstack/react-query'

import { systemVersion } from '#/api/mapping/mapping'

import { read, settle } from '../calls'
import { systemRead } from './queries'

/** How often a page following closely polls the System's Version, in milliseconds. */
const closelyEvery = 2_000

/** The System's Version's read, by the server function's name. */
const versionScope = 'systemVersion'

/** The System's Version, asked of its server function. */
const askVersion = () => systemVersion({ data: undefined })

/** The System's Version, read alone: a frame read, whose failure is reported and shows nothing. */
const versionRead = read({ scope: versionScope, key: [], call: askVersion, frame: true })

/** Whether the System the cache holds is behind this Version; not before its first read. */
function behind(client: QueryClient, version: number) {
  const held = client.getQueryData(systemRead.queryKey)
  return held !== undefined && version > held.version
}

/**
 * Polls the System's Version, then reads the System again while the cache is behind it: a read
 * already on its way is left to land, and, should it have started before the Version moved, one more
 * is made once it has.
 */
async function polled(client: QueryClient): Promise<number> {
  const version = await settle(versionScope, askVersion())
  for (let reads = 0; reads < 2 && behind(client, version); reads++) {
    await client.invalidateQueries({ queryKey: systemRead.queryKey }, { cancelRefetch: false })
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
    queryFn: () => polled(client),
    refetchOnWindowFocus: 'always',
    refetchInterval: closely ? closelyEvery : false,
  })
}
