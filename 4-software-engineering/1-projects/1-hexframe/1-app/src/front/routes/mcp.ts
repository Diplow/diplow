// `/mcp`, the MCP endpoint: a raw server route, handed over whole to the API layer (src/api/CLAUDE.md).
import { createFileRoute } from '@tanstack/react-router'

import { methodNotAllowed, serveMcp } from '#/api/server/mcp/mcp'

export const Route = createFileRoute('/mcp')({
  server: {
    handlers: {
      POST: ({ request }) => serveMcp(request),
      GET: methodNotAllowed,
      DELETE: methodNotAllowed,
    },
  },
})
