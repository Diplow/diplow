// The auth harness: Better Auth for real, over the PGlite test database, its cookies signed with a
// secret made for the run; a browser, a cookie jar that carries what one call sets to the next, from
// an IP of its own, as Better Auth's rate limiter counts attempts per IP; and a program calling with an
// API key, as an MCP client does.
import { Effect, Layer, Redacted } from 'effect'

import { TestDatabase } from '../database/testing'
import { Auth, HttpExchange, localBaseURL, make } from './auth'

/** A secret made for the run. */
export const testSecret = () => Redacted.make(crypto.randomUUID() + crypto.randomUUID())

/** Auth over a fresh, migrated PGlite. The database is provided too, to look behind Better Auth. */
export const TestAuth = Layer.effect(Auth)(
  Effect.suspend(() => make(testSecret(), localBaseURL)),
).pipe(Layer.provideMerge(TestDatabase))

/** A Set-Cookie line's cookie, by name; an emptied value means the cookie is gone. */
function parseSetCookie(setCookie: string) {
  const [pair = ''] = setCookie.split(';')
  const separator = pair.indexOf('=')
  return { name: pair.slice(0, separator).trim(), value: pair.slice(separator + 1).trim() }
}

let browsers = 0

/** One browser: the cookies each call sets are sent with the next, as HttpExchange, from its own IP. */
export function browser() {
  browsers += 1
  const ip = `10.0.${String(Math.floor(browsers / 250))}.${String((browsers % 250) + 1)}`
  const jar = new Map<string, string>()
  const exchange = () =>
    HttpExchange.of({
      url: 'http://localhost/_serverFn',
      headers: new Headers({
        cookie: [...jar].map(([name, value]) => `${name}=${value}`).join('; '),
        'x-forwarded-for': ip,
      }),
      setCookies: (cookies) => {
        for (const { name, value } of cookies.map(parseSetCookie)) {
          if (value === '') jar.delete(name)
          else jar.set(name, value)
        }
      },
    })
  return {
    /** Runs `program` as a request from this browser. */
    request: <A, E, R>(program: Effect.Effect<A, E, R>) =>
      Effect.suspend(() => Effect.provideService(program, HttpExchange, exchange())),
    cookies: () => [...jar.keys()],
  }
}

/** A program calling with an API key, as an MCP client does: its `Authorization` header, no cookie. */
export function keyClient(secret: string, scheme = 'Bearer') {
  const exchange = HttpExchange.of({
    url: 'http://localhost/mcp',
    headers: new Headers({ authorization: `${scheme} ${secret}` }),
    setCookies: () => undefined,
  })
  return {
    /** Runs `program` as a request from this client. */
    request: <A, E, R>(program: Effect.Effect<A, E, R>) =>
      Effect.provideService(program, HttpExchange, exchange),
  }
}
