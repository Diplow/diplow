// Start's middleware stays promise-based: it puts what it knows about the request on Start's
// `context`, and the helper (./run.ts) hands it to the program as Effect services. src/start.ts runs it
// before every server function: the request id, the platform's waitUntil, the request's headers and
// cookies, and the Session its cookie proves. Auth is checked here, once, for every server function,
// after `sameOriginOnly` has refused a call from another site. A Key proves nothing here: `/mcp` is
// the one door it opens (src/api/CLAUDE.md).
import { createCsrfMiddleware, createMiddleware } from '@tanstack/react-start'
import { getRequest, getResponseHeaders } from '@tanstack/react-start/server'

import { noKey, provenSession, type StartContext } from './run'

/** A request as Nitro hands it over (srvx's `ServerRequest`), with the platform's `waitUntil`. */
type PlatformRequest = Request & Pick<StartContext, 'waitUntil'>

function isPlatformRequest(request: Request): request is PlatformRequest {
  return 'waitUntil' in request && typeof request.waitUntil === 'function'
}

/**
 * The platform's `waitUntil`, which Nitro puts on the request: Vercel's on Vercel, srvx's own under
 * `pnpm dev`. Where there is none, the work still runs; nothing keeps the function up for it. `/mcp`
 * takes it from here too.
 */
export function waitUntilOf(request: Request): StartContext['waitUntil'] {
  return (promise) => {
    if (isPlatformRequest(request)) request.waitUntil(promise)
  }
}

/** The request's headers, and the response's, where the cookies a call sets are appended. */
function exchangeOf(request: Request): StartContext['exchange'] {
  return {
    url: request.url,
    headers: request.headers,
    setCookies: (cookies) => {
      const response = getResponseHeaders()
      for (const cookie of cookies) response.append('set-cookie', cookie)
    },
  }
}

export const requestContext = createMiddleware({ type: 'function' }).server(
  async ({ next, serverFnMeta }) => {
    const request = getRequest()
    const requestId = crypto.randomUUID()
    const exchange = exchangeOf(request)
    const context: StartContext = {
      requestId,
      scope: serverFnMeta.name,
      waitUntil: waitUntilOf(request),
      exchange,
      session: await provenSession(exchange),
      key: noKey,
    }
    return next({ context })
  },
)

/**
 * Refuses a server function call from another site before anything runs (Start's CSRF check, on
 * `Sec-Fetch-Site`, then `Origin`, then `Referer`): the session cookie rides along with every call,
 * so a page elsewhere could otherwise sign someone out, or in as someone else.
 */
export const sameOriginOnly = createCsrfMiddleware({
  filter: (context) => context.handlerType === 'serverFn',
})
