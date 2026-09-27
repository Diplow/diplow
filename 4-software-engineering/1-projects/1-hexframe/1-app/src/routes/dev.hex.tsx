// HEX-9, throwaway: the SVG canvas on the fixture System, one scene at a time.
import { Link, createFileRoute, notFound } from '@tanstack/react-router'

import { scenes, ulysse, type Scene } from '#/ui/hex/prototype/fixtures'
import { SvgCanvas } from '#/ui/hex/prototype/SvgCanvas'

export const Route = createFileRoute('/dev/hex')({
  // A dev page, like /dev/ui: production answers 404 (vite.config.ts).
  beforeLoad: () => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router's notFound() is meant to be thrown; the router catches it
    if (!__DEV_PAGES__) throw notFound()
  },
  validateSearch: (search: Record<string, unknown>): { scene: Scene } => ({
    scene:
      typeof search.scene === 'string' && Object.hasOwn(scenes, search.scene)
        ? (search.scene as Scene)
        : 'frame',
  }),
  component: HexPrototype,
})

function HexPrototype() {
  const { scene } = Route.useSearch()
  const { view } = scenes[scene]
  return (
    <main className="flex flex-col items-center px-6 pb-6">
      <nav className="mb-4 flex justify-center gap-2">
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
      <SvgCanvas center={ulysse} view={view} className="h-[calc(100dvh-9rem)] max-w-full" />
    </main>
  )
}
