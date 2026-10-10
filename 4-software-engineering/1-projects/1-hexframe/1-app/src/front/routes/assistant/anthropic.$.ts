// `/assistant/anthropic`, the model proxy: the base URL a Turn's agent calls Anthropic through, a raw
// server route handed over whole to the API layer (src/api/CLAUDE.md). Its path after the base is the
// splat, `/v1/messages` and `/v1/messages/count_tokens` alone served.
import { createFileRoute } from '@tanstack/react-router'

import { methodNotAllowed, serveModelCall } from '#/api/server/proxy/proxy'

export const Route = createFileRoute('/assistant/anthropic/$')({
  server: {
    handlers: {
      POST: ({ request, params }) => serveModelCall(request, `/${params._splat ?? ''}`),
      GET: methodNotAllowed,
      PUT: methodNotAllowed,
      PATCH: methodNotAllowed,
      DELETE: methodNotAllowed,
    },
  },
})
