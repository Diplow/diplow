// Who reaches a Tile on the client, over Mapping's server functions (src/api/mapping/mapping.ts): who
// reaches it, read as one query by the Tile, and its Grant for Everyone set or removed, which reads
// who reaches it again once it settles, failed or not. Both are its owner's alone, from a Session: a
// refusal goes to its channel (../channels.ts), and a hook's caller handles none. Setting a Grant
// changes nothing the owner's own read of the System shows, so it is read again for no write here.
// And the star someone is shared with, found by what is typed in the star picker: a Title, or a link
// to a Tile, which leads to the star of its System (HEX-130).
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Schema } from 'effect'

import { tileOfLink } from '#/api/mapping/files/download'
import { findStars, setGrant, starOfLink, whoReaches } from '#/api/mapping/mapping'
import { type GrantChange, type LinkedStar, starQueryOf, TileId } from '#/domains/mapping/entities'
import type { StarsShown } from '#/front/ui/chat/widgets/star-picker/StarPicker'

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

/**
 * What is typed in the star picker, read: a link, when it reads as one, its scheme's or a path on
 * this site, `/t/<id>`, which leads to the Tile it names on the page's site, a UUID, `undefined` for
 * one that names none; else a Title, the query it makes, `undefined` while too short to search.
 */
export type Typed =
  | { readonly by: 'link'; readonly tile: string | undefined }
  | { readonly by: 'title'; readonly query: string | undefined }

/** A link as someone pastes one: a path on this site, or an address with its scheme. */
const asLink = /^(?:\/|https?:\/\/)/i

/** What is typed, read as a link or a Title, on the page at `page`. */
export function typedOf(typed: string, page: string): Typed {
  const text = typed.trim()
  if (!asLink.test(text)) return { by: 'title', query: starQueryOf(text) }
  const tile = URL.canParse(text, page) ? tileOfLink(page)(new URL(text, page).href) : undefined
  return { by: 'link', tile: tile !== undefined && Schema.is(TileId)(tile) ? tile : undefined }
}

/** Where a link led, as the picker shows it. */
const linkedAs = (linked: LinkedStar): StarsShown => {
  if (linked._tag === 'Star') return { state: 'found', stars: [linked.star] }
  return { state: linked._tag === 'Own' ? 'own' : 'nowhere' }
}

/**
 * The stars what is typed in the star picker leads to, on this page (`typedOf`), as its widget shows
 * them (`StarsShown`): those whose Title
 * holds it, a query by what it makes (`['findStars', 'read', query]`), the last stars found shown,
 * `stale`, while the next are on their way; or the star a link leads to, a query by its Tile
 * (`['starOfLink', 'read', tile]`). Nothing is asked while it is too short, or names no Tile.
 */
export function useStarsFor(typed: string, page: string): StarsShown {
  const asked = typedOf(typed, page)
  const query = asked.by === 'title' ? asked.query : undefined
  const tile = asked.by === 'link' ? asked.tile : undefined
  const titled = useQuery({
    ...read({
      scope: 'findStars',
      key: [query],
      call: () => findStars({ data: { query: query ?? '' } }),
    }),
    enabled: query !== undefined,
    placeholderData: keepPreviousData,
  })
  const linked = useQuery({
    ...read({
      scope: 'starOfLink',
      key: [tile],
      call: () => starOfLink({ data: { tile: tile ?? '' } }),
    }),
    enabled: tile !== undefined,
  })
  if (asked.by === 'link') {
    if (tile === undefined) return { state: 'nowhere' }
    return linked.data === undefined ? { state: 'looking' } : linkedAs(linked.data)
  }
  if (query === undefined) return { state: 'short' }
  if (titled.data === undefined) return { state: 'looking' }
  return titled.isPlaceholderData
    ? { state: 'found', stars: titled.data, stale: true }
    : { state: 'found', stars: titled.data }
}
