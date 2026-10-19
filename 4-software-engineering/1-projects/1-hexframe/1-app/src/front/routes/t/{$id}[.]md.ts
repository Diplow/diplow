// `/t/<id>.md`, a public Tile as Markdown, for anyone holding the link, an LLM fetching a URL among
// them: a raw server route handed over whole to the API layer (src/api/CLAUDE.md, HEX-129).
import { createFileRoute } from '@tanstack/react-router'

import { methodNotAllowed, servePublicTile } from '#/api/server/public/public'

export const Route = createFileRoute('/t/{$id}.md')({
  server: {
    handlers: {
      GET: ({ request, params }) => servePublicTile(request, params.id),
      POST: methodNotAllowed,
      PUT: methodNotAllowed,
      PATCH: methodNotAllowed,
      DELETE: methodNotAllowed,
    },
  },
})
