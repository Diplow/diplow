// Who reaches a Tile on the client, over Mapping's server functions (src/api/mapping/mapping.ts): who
// reaches it, read as one query by the Tile, and its Grant for Everyone set or removed, which reads
// who reaches it again once it settles, failed or not. Both are its owner's alone, from a Session: a
// refusal goes to its channel (../channels.ts), and a hook's caller handles none. Setting a Grant
// changes nothing the owner's own read of the System shows, so it is read again for no write here.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { setGrant, whoReaches } from '#/api/mapping/mapping'
import type { GrantChange } from '#/domains/mapping/entities'

import { read, write } from '../calls'

/** Who reaches a Tile, by the server function's name: every mode of its query key starts with it. */
const reachScope = 'whoReaches'

/**
 * Who reaches a Tile, Everyone first, each subject with its value and the Tile it comes from. Signed
 * out, it sends the user to sign in.
 */
export const useWhoReaches = (tile: string) =>
  useQuery(read({ scope: reachScope, key: [tile], call: () => whoReaches({ data: { tile } }) }))

/** Sets a Tile's Grant for Everyone, or removes it, then reads who reaches it again. */
export const useSetGrant = () => {
  const client = useQueryClient()
  return useMutation({
    ...write('setGrant', (data: GrantChange) => setGrant({ data })),
    onSettled: () => client.invalidateQueries({ queryKey: [reachScope] }),
  })
}
