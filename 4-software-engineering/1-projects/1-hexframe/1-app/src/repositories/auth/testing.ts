// The auth harness: Better Auth for real, over the PGlite test database, its cookies signed with a
// secret made for the run; and a browser, a cookie jar that carries what one call sets to the next.
import { Effect, Layer, Redacted } from 'effect'

import { TestDatabase } from '../database/testing'
import { Auth, HttpExchange, make } from './auth'

/** Auth over a fresh, migrated PGlite. The database is provided too, to look behind Better Auth. */
export const TestAuth = Layer.effect(Auth)(
  Effect.suspend(() => make(Redacted.make(crypto.randomUUID() + crypto.randomUUID()))),
).pipe(Layer.provideMerge(TestDatabase))

/** A cookie's name and value, from a Set-Cookie line; an emptied value means the cookie is gone. */
function parsed(setCookie: string) {
  const [pair = ''] = setCookie.split(';')
  const separator = pair.indexOf('=')
  return { name: pair.slice(0, separator).trim(), value: pair.slice(separator + 1).trim() }
}

/** One browser: the cookies each call sets are sent with the next, as HttpExchange. */
export function browser() {
  const jar = new Map<string, string>()
  const exchange = () =>
    HttpExchange.of({
      headers: new Headers({
        cookie: [...jar].map(([name, value]) => `${name}=${value}`).join('; '),
      }),
      setCookies: (cookies) => {
        for (const { name, value } of cookies.map(parsed)) {
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
