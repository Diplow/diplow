// @vitest-environment happy-dom
import { QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as Mapping from '#/api/mapping/mapping'
import type { PlacedTile, Seen } from '#/domains/mapping/entities'
import { makeQueryClient } from '#/front/client/channels'
import { m } from '#/paraglide/messages'

import type { SystemSearch } from '../search/search'
import { useTileWidgetsState } from './state/useTileWidgetsState'
import { TileWidgets } from './TileWidgets'

// The tile widget on a System visited, over a stand-in for the server function: a Tile's forms open
// on the Tiles the visitor is shown across a gap, as on those below the star.
vi.mock('#/api/mapping/mapping', () => ({ system: vi.fn() }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const writes = ['read', 'write'] as const

/**
 * Ana's System, her star kept from the visitor but its card: Deep, below a Tile kept from them,
 * hangs from the star across the gap, and Kid stands under it in 2. They write both.
 */
const anas: Seen = {
  root: { _tag: 'Tile', id: 'ana', title: 'Ana', preview: '', body: '', version: 1 },
  tiles: {
    kid: {
      _tag: 'Tile',
      id: 'kid',
      title: 'Kid',
      preview: '',
      body: '',
      version: 1,
      parent: 'deep',
      slot: 2,
    } satisfies PlacedTile,
  },
  gaps: { deep: { _tag: 'Tile', id: 'deep', title: 'Deep', preview: '', body: '', version: 3 } },
  rights: { ana: [], deep: [...writes], kid: [...writes] },
  pinned: {},
  asOwner: false,
  version: 0,
}

/** The widget at the chat's foot while the URL visits Ana's star, with these search params. */
function Widgets({ search }: { search: SystemSearch }) {
  const widgets = useTileWidgetsState()
  return createElement(TileWidgets, {
    search,
    onSearchChange: vi.fn(),
    onCenter: vi.fn(),
    widgets,
    onFormBack: vi.fn(),
    visiting: 'ana',
  })
}

function rendering(search: SystemSearch) {
  vi.mocked(Mapping.system).mockResolvedValue({ ok: true, value: anas } as never)
  const client = makeQueryClient()
  render(createElement(QueryClientProvider, { client }, createElement(Widgets, { search })))
}

describe('the tile widget on a System visited, across a gap', () => {
  it('opens the edit of a Tile hung from the star, and of one below it', async () => {
    rendering({ edit: 'deep' })
    expect(await screen.findByDisplayValue('Deep')).toBeDefined()
    cleanup()
    rendering({ edit: 'kid' })
    expect(await screen.findByDisplayValue('Kid')).toBeDefined()
  })

  it('opens a new Tile under a Tile hung from the star', async () => {
    rendering({ add: 'deep', slot: { leaf: 1 } })
    expect(await screen.findByLabelText(m.system_field_title())).toHaveProperty('value', '')
  })
})
