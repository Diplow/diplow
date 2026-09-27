// HEX-9, throwaway: the two canvas renderers side by side on the same geometry, one scene at a time.
import { Link, createFileRoute } from '@tanstack/react-router'

import { scenes, ulysse, type Scene } from '#/ui/hex/prototype/fixtures'
import { HtmlCanvas } from '#/ui/hex/prototype/HtmlCanvas'
import { SvgCanvas } from '#/ui/hex/prototype/SvgCanvas'

export const Route = createFileRoute('/dev/hex')({
  validateSearch: (search: Record<string, unknown>): { scene: Scene } => ({
    scene:
      typeof search.scene === 'string' && search.scene in scenes
        ? (search.scene as Scene)
        : 'frame',
  }),
  component: HexPrototype,
})

const radius = 320

function HexPrototype() {
  const { scene } = Route.useSearch()
  const { view } = scenes[scene]
  return (
    <main className="px-6 pb-12">
      <nav className="mb-6 flex justify-center gap-2">
        {Object.entries(scenes).map(([key, { label }]) => (
          <Link
            key={key}
            to="/dev/hex"
            search={{ scene: key as Scene }}
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground"
            activeProps={{ className: 'bg-muted text-foreground' }}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="flex flex-wrap justify-center gap-10">
        <figure className="flex flex-col items-center gap-3">
          <HtmlCanvas center={ulysse} view={view} radius={radius} />
          <figcaption className="text-sm text-muted-foreground">A · HTML clip-path</figcaption>
        </figure>
        <figure className="flex flex-col items-center gap-3">
          <SvgCanvas center={ulysse} view={view} radius={radius} />
          <figcaption className="text-sm text-muted-foreground">B · SVG</figcaption>
        </figure>
      </div>
    </main>
  )
}
