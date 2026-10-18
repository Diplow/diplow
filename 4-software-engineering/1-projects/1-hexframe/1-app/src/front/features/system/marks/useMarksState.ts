// What home's canvas marks of who touches its Tiles, and what passes from the chat to it (HEX-109): the
// Tile the chat points at, a name hovered or focused, or the `@` list's row; the Tile it centered,
// glinting; the Tile the running Turn works in; the changes the agent or a Key made since the page
// opened, each glinting as it comes and keeping its dot until the user opens its Tile; and the open
// Proposal, folded over the System it changes, drawn while the canvas shows that one, the Account's
// own or the one it visits. It reads today's Entries and the open Proposal beside the chat
// (`useToday`); the route hands it the Account's System, the one visited and the Turn running, and
// tells it what the chat points at, what it centered and where the user went.
import { useMemo, useState } from 'react'

import type { System } from '#/domains/mapping/entities'
import { useToday } from '#/front/client/assistant/conversation'
import type { Gesture, ViewAction } from '#/front/ui/canvas/view/view'

import { acceptedOf, type Arrival, canvasMarksOf, cardOf, touchesOf } from './marks'
import { proposedOf } from './proposal'

/** The gestures that open a Tile or center it, which see its changes. */
const opening: ReadonlySet<Gesture> = new Set<Gesture>([
  'center',
  'expand',
  'show-context',
  'show-leaves',
])

interface MarksInput {
  /** The Account's own System as the page shows it, flat; none before it is read. */
  system: System | undefined
  /**
   * The System the page visits instead, someone else's, by its star, and as the canvas shows it,
   * flat, none before it is read; no star at home.
   */
  visited: { readonly star: string | undefined; readonly system: System | undefined }
  /** The Tile the running Turn works in, its location; none while no Turn runs. */
  working: string | undefined
}

/**
 * The System the open Proposal changes, as the page holds it: the Account's own, or the one it
 * visits when the Proposal is over that one (`elsewhere`), by its star; none for another, nor before
 * it is read.
 */
const changedBy = (
  elsewhere: string | undefined,
  { system, visited }: Pick<MarksInput, 'system' | 'visited'>,
) => {
  if (elsewhere === undefined) return system
  return elsewhere === visited.star ? visited.system : undefined
}

export function useMarksState({ system, visited, working }: MarksInput) {
  const today = useToday()
  const [pointed, setPointed] = useState<string>()
  const [arrived, setArrived] = useState<Arrival>()
  // The Entries today held as the page first read it: a change among them is no news.
  const [known, setKnown] = useState<ReadonlySet<string>>()
  // The Proposals the page saw open, whose acceptance is the user's own.
  const [watched, setWatched] = useState<ReadonlySet<string>>(new Set())
  // The changes whose Tile the user opened since.
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set())
  // The glints that have played: the view changed since they rose.
  const [played, setPlayed] = useState<ReadonlySet<string>>(new Set())
  // Kept as the reads come, while rendering, as React keeps what a previous render saw.
  if (known === undefined && today !== undefined) {
    setKnown(new Set(today.entries.map(({ id }) => id)))
  }
  const proposal = today?.proposal
  const open = proposal?.id
  if (open !== undefined && !watched.has(open)) setWatched(new Set([...watched, open]))
  const writes = proposal?.writes
  const changed =
    proposal === undefined ? undefined : changedBy(proposal.elsewhere, { system, visited })
  const proposed = useMemo(
    () => (changed === undefined || writes === undefined ? undefined : proposedOf(changed, writes)),
    [changed, writes],
  )
  // Drawn while the canvas shows the System it changes; named in the chat's cards, which read the
  // Account's own, when it changes that one.
  const drawn = proposal?.elsewhere === visited.star ? proposed : undefined
  const named = proposal?.elsewhere === undefined ? proposed : undefined
  const entries = today?.entries ?? []
  const touches =
    known === undefined ? [] : touchesOf(entries, { known, accepted: acceptedOf(entries, watched) })
  /** The user opened a Tile: its changes so far are seen. */
  const openTile = (tile: string) => {
    const seen = touches.filter((touch) => touch.tile === tile).map(({ entry }) => entry)
    if (seen.length > 0) setOpened((before) => new Set([...before, ...seen]))
  }
  /** The view changed: every glint risen so far has played, and won't rise again as a Tile remounts. */
  const viewChanged = () => {
    const risen = [...touches.map(({ entry }) => entry), ...(arrived ? [arrived.key] : [])]
    setPlayed((before) => new Set([...before, ...risen]))
  }
  return {
    marks: canvasMarksOf({ pointed, arrived, working, touches, opened, played, proposed: drawn }),
    /** What a Tile named in the chat says in its card; none before the System is read. */
    cardOf: (id: string) => (system === undefined ? undefined : cardOf(system, named, id)),
    actions: {
      /**
       * A name's card opened or shut: the Tile is pointed at meanwhile. A card shutting clears its own
       * Tile only, so going from one name to the next keeps the next one lit.
       */
      point: (id: string, pointing: boolean) => {
        setPointed((current) => (pointing ? id : current === id ? undefined : current))
      },
      /** The `@` list's row the user is on, a Tile's, or none. */
      pointRow: (row: string | undefined) => {
        setPointed(row)
      },
      /** The chat centered a Tile: it glints as the canvas arrives, and the user opened it. */
      arrive: (tile: string) => {
        viewChanged()
        const lastEntry = touches.findLast((touch) => touch.tile === tile)?.entry
        setArrived({ id: tile, key: String(Date.now()), lastEntry })
        openTile(tile)
      },
      /**
       * A gesture on the canvas: the glints so far have played, and a gesture that opens a Tile, or
       * centers it, sees its changes; one that closes or hides leaves its dot.
       */
      went: ({ gesture, tile }: ViewAction) => {
        viewChanged()
        if (opening.has(gesture)) openTile(tile)
      },
    },
  }
}
