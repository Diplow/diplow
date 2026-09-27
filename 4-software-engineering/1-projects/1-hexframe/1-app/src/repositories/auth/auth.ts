// The auth repository: Better Auth over the database, as one Auth service in Better Auth's own terms
// (a user, a session). IAM, above, turns them into its Accounts and Sessions. Better Auth is called
// through its server API, never through an HTTP handler of its own: every call comes from a server
// function, and the cookies it reads and sets travel through HttpExchange.
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { isAPIError } from 'better-auth/api'
import { betterAuth } from 'better-auth/minimal'
import { Config, Context, Data, Effect, Layer, Option, Redacted } from 'effect'

import { PromiseDatabase } from '../database/database'
import { account, session, user, verification } from '../database/schema'

/**
 * The HTTP request a call to Better Auth belongs to: the headers it reads (the session cookie, the
 * user agent), and where the cookies it sets go, on the response. The server function helper
 * provides it to each request's program.
 */
export class HttpExchange extends Context.Service<
  HttpExchange,
  {
    readonly headers: Headers
    readonly setCookies: (cookies: ReadonlyArray<string>) => void
  }
>()('hexframe/HttpExchange') {}

/** Someone Better Auth knows: IAM's Account. Its name is not kept here (see ./CLAUDE.md). */
export interface AuthUser {
  readonly id: string
  readonly email: string
}

/** A signed-in user, on one device, until it expires. The token stays in its cookie. */
export interface AuthSession {
  readonly user: AuthUser
  readonly expiresAt: Date
}

export interface Credentials {
  readonly email: string
  readonly password: string
}

/** Why Better Auth said no to credentials: the only failures it reports that a user can fix. */
export type Refusal = 'credentials-rejected' | 'email-taken' | 'email-malformed' | 'password-length'

export class AuthRefused extends Data.TaggedError('AuthRefused')<{ readonly reason: Refusal }> {}

export class Auth extends Context.Service<
  Auth,
  {
    /** Creates the user and signs it in: the session cookie is set. */
    readonly signUp: (
      credentials: Credentials,
    ) => Effect.Effect<AuthUser, AuthRefused, HttpExchange>
    /** Signs an existing user in: the session cookie is set. */
    readonly signIn: (
      credentials: Credentials,
    ) => Effect.Effect<AuthUser, AuthRefused, HttpExchange>
    /** Ends the request's session, if any, and clears its cookie. */
    readonly signOut: Effect.Effect<void, never, HttpExchange>
    /** The session the request's cookie proves, if it is still valid. */
    readonly session: Effect.Effect<Option.Option<AuthSession>, never, HttpExchange>
  }
>()('hexframe/Auth') {}

/** Better Auth's error codes a user can fix, and what each means here; any other error is a defect. */
const refusals: Partial<Record<string, Refusal>> = {
  INVALID_EMAIL_OR_PASSWORD: 'credentials-rejected',
  USER_ALREADY_EXISTS: 'email-taken',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'email-taken',
  INVALID_EMAIL: 'email-malformed',
  PASSWORD_TOO_SHORT: 'password-length',
  PASSWORD_TOO_LONG: 'password-length',
}

/** The refusal an error from Better Auth stands for, if it is one. */
function refusalOf(error: unknown): Refusal | undefined {
  if (!isAPIError(error)) return undefined
  const code = String(error.body?.code)
  // A malformed email fails Better Auth's input schema, whose message alone names the field.
  if (code === 'VALIDATION_ERROR') {
    return error.body?.message?.startsWith('[body.email]') ? 'email-malformed' : undefined
  }
  return refusals[code]
}

function refusedOrDefect(error: unknown) {
  const reason = refusalOf(error)
  return reason === undefined ? Effect.die(error) : Effect.fail(new AuthRefused({ reason }))
}

/** A call to Better Auth's server API with the request's headers, passing the cookies it sets on. */
function exchanged<A>(call: (headers: Headers) => Promise<{ headers: Headers; response: A }>) {
  return Effect.gen(function* () {
    const exchange = yield* HttpExchange
    const { headers, response } = yield* Effect.tryPromise({
      try: () => call(exchange.headers),
      catch: (error) => error,
    }).pipe(Effect.catch(refusedOrDefect))
    const cookies = headers.getSetCookie()
    if (cookies.length > 0) exchange.setCookies(cookies)
    return response
  })
}

const userOf = ({ id, email }: AuthUser): AuthUser => ({ id, email })

/** The Auth service over Better Auth, signing its cookies with `secret`. */
export const make = (secret: Redacted.Redacted) =>
  Effect.gen(function* () {
    const database = yield* PromiseDatabase
    const auth = betterAuth({
      secret: Redacted.value(secret),
      database: drizzleAdapter(database, {
        provider: 'pg',
        schema: { user, session, account, verification },
      }),
      emailAndPassword: { enabled: true },
      telemetry: { enabled: false },
    })
    // Better Auth wants a name for its emails; IAM leaves it empty until Mapping copies the Root's Title.
    const signUp = ({ email, password }: Credentials) =>
      exchanged((headers) =>
        auth.api.signUpEmail({ body: { email, password, name: '' }, headers, returnHeaders: true }),
      ).pipe(Effect.map(({ user }) => userOf(user)))
    const signIn = ({ email, password }: Credentials) =>
      exchanged((headers) =>
        auth.api.signInEmail({ body: { email, password }, headers, returnHeaders: true }),
      ).pipe(Effect.map(({ user }) => userOf(user)))
    const signOut = exchanged((headers) => auth.api.signOut({ headers, returnHeaders: true })).pipe(
      Effect.catchTag('AuthRefused', Effect.die),
      Effect.asVoid,
    )
    const current = exchanged((headers) =>
      auth.api.getSession({ headers, returnHeaders: true }),
    ).pipe(
      Effect.catchTag('AuthRefused', Effect.die),
      Effect.map((found) =>
        Option.map(Option.fromNullishOr(found), ({ user, session }) => ({
          user: userOf(user),
          expiresAt: session.expiresAt,
        })),
      ),
    )
    return Auth.of({ signUp, signIn, signOut, session: current })
  })

/** The deployed Auth, its cookies signed with BETTER_AUTH_SECRET. */
export const layer = Layer.effect(Auth)(
  Effect.gen(function* () {
    return yield* make(yield* Config.Redacted('BETTER_AUTH_SECRET'))
  }),
)
