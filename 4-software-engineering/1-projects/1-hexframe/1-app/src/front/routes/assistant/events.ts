// `/assistant/events`, the Turn's events: where a Turn's sandbox posts each line of what its agent
// says, a raw server route handed over whole to the API layer (src/api/CLAUDE.md).
import { createFileRoute } from '@tanstack/react-router'

import { methodNotAllowed, serveTurnEvent } from '#/api/server/events/events'

export const Route = createFileRoute('/assistant/events')({
  server: {
    handlers: {
      POST: ({ request }) => serveTurnEvent(request),
      GET: methodNotAllowed,
      PUT: methodNotAllowed,
      PATCH: methodNotAllowed,
      DELETE: methodNotAllowed,
    },
  },
})
