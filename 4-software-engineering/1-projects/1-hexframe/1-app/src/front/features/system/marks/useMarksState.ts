// What home's canvas marks of who touches its Tiles, and what passes from the chat to it (HEX-109): the
// Tile the chat points at, a name hovered or focused, or the `@` list's row; the Tile it centered,
// glinting; the Tile the running Turn works in; the changes the agent or a Key made since the page
// opened, each glinting as it comes and keeping its dot until the user opens its Tile; and the open
// Proposal, folded over the System the page shows. It reads today's Entries and the open Proposal
// beside the chat (`useToday`); the route hands it the System and the Turn running, and tells it what
// the chat points at, what it centered and where the user went.
import { useMemo, useState } from 'react'

import type { System } from '#/domains/mapping/entities'
import { useToday } from '#/front/client/assistant/conversation'

import { acceptedOf, canvasMarksOf, cardOf, type Glint, touchesOf } from './marks'
import { proposedOf } from './proposal'

interface MarksInput {
  /** The System as the page shows it, flat; none before it is read. */
  system: System | undefined
  /** The Tile the running Turn works in, its location; none while no Turn runs. */
  working: string | undefined
}

export function useMarksState({ system, working }: MarksInput) {
  const today = useToday()
  const [pointed, setPointed] = useState<string>()
  const [arrived, setArrived] = useState<Glint>()
  // The Entries today held as the page first read it: a change among them is no news.
  const [known, setKnown] = useState<ReadonlySet<string>>()
  // The Proposals the page saw open, whose acceptance is the user's own.
  const [watched, setWatched] = useState<ReadonlySet<string>>(new Set())
  // The changes whose Tile the user opened since.
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set())
  // Kept as the reads come, while rendering, as React keeps what a previous render saw.
  if (known === undefined && today !== undefined) {
    setKnown(new Set(today.entries.map(({ id }) => id)))
  }
  const open = today?.proposal?.id
  if (open !== undefined && !watched.has(open)) setWatched(new Set([...watched, open]))
  const writes = today?.proposal?.writes
  const proposed = useMemo(
    () => (system === undefined || writes === undefined ? undefined : proposedOf(system, writes)),
    [system, writes],
  )
  const entries = today?.entries ?? []
  const touches =
    known === undefined ? [] : touchesOf(entries, { known, accepted: acceptedOf(entries, watched) })
  /** The user opened a Tile: its changes so far are seen. */
  const openTile = (tile: string) => {
    const seen = touches.filter((touch) => touch.tile === tile).map(({ key }) => key)
    if (seen.length > 0) setOpened((before) => new Set([...before, ...seen]))
  }
  return {
    marks: canvasMarksOf({ pointed, arrived, working, touches, opened, proposed }),
    /** What a Tile named in the chat says in its card; none before the System is read. */
    cardOf: (id: string) => (system === undefined ? undefined : cardOf(system, proposed, id)),
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
        setArrived({ id: tile, key: String(Date.now()) })
        openTile(tile)
      },
      /** The user went to a Tile on the canvas. */
      open: openTile,
    },
  }
}
