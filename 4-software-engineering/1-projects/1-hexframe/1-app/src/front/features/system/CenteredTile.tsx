// The centered Tile's card at the canvas's foot: its title, what it is, and a Leaf that isn't
// Markdown's Body as code. What can be done to it is in its menu on the canvas since HEX-107, where
// the card's buttons went, but an empty System's way in, Import a vault, which its description invites
// (`hexframe-app-design-system-v1/decisions.md#DEC-47`).
import { isEmptySystem, type SystemTile } from '#/domains/mapping/entities'
import { m } from '#/paraglide/messages'
import type { TileNode } from '#/front/ui/canvas/view/tiles'
import { showView } from '#/front/ui/canvas/view/view'
import { Button } from '#/front/ui/atoms/controls/button'
import { CodeBlock } from '#/front/ui/seams/Markdown'
import { Card } from '#/front/ui/canvas/layouts/Card'

import { codeOf } from './acting'
import { viewOf, withChange, type SearchChange, type SystemSearch } from './search/search'
import { tileIn } from './tree'

interface CenteredTileProps {
  /** The System's Root, with everything below it. */
  system: SystemTile
  /** The System's Tiles as the canvas draws them (`canvasTree`). */
  tree: TileNode
  search: SystemSearch
  onSearchChange: (change: SearchChange) => void
}

export function CenteredTile({ system, tree, search, onSearchChange }: CenteredTileProps) {
  const center = showView(tree, viewOf(search)).center
  // A broken Reference, centered, stands for no Tile: there is nothing to show.
  const found = tileIn(system, center.id)
  if (found === undefined) return null
  const description =
    found.parent === undefined
      ? isEmptySystem(system)
        ? m.system_root_empty_description()
        : m.system_root_description()
      : center.preview
  const code = codeOf(system, center.id)
  return (
    <Card
      title={center.title}
      description={description === '' ? undefined : description}
      footer={
        found.parent === undefined && isEmptySystem(system) ? (
          <Button
            size="sm"
            onClick={() => {
              onSearchChange(withChange(search, { kind: 'import', place: { _tag: 'Root' } }))
            }}
          >
            {m.system_import_vault()}
          </Button>
        ) : undefined
      }
    >
      {code !== undefined && <CodeBlock code={code} label={center.title} />}
    </Card>
  )
}
