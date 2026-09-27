// The auth repository: Better Auth over the database, as one Auth service in Better Auth's own terms
// (a user, a session). IAM, above, turns them into its Accounts and Sessions. Better Auth has no route
// of its own: every call comes from a server function, and the cookies it reads and sets travel
// through HttpExchange. Signing up and in go through its request handler, where its rate limiter runs.
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { betterAuth } from 'better-auth/minimal'
import { Config, Context, Data, Effect, Layer, Option, Redacted, Schema } from 'effect'

import { PromiseDatabase, layer as promiseLayer } from '../database/promise'
import { account, rateLimit, session, user, verification } from '../database/schema'

/**
 * The HTTP request a call to Better Auth belongs to: its URL, whose origin Better Auth's endpoints are
 * reached on; the headers it reads (the session cookie, the client's IP, the user agent); and where
 * the cookies it sets go, on the response. The server function helper provides it to each program.
 */
export class HttpExchange extends Context.Service<
  HttpExchange,
  {
    readonly url: string
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

interface Credentials {
  readonly email: string
  readonly password: string
}

/** Why Better Auth said no to credentials: the failures it reports that a user can act on. */
export type Refusal =
  | 'credentials-rejected'
  | 'email-taken'
  | 'email-malformed'
  | 'password-length'
  | 'too-many-attempts'

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

/** Better Auth's error codes a user can act on, and what each means here; any other is a defect. */
const refusals: Partial<Record<string, Refusal>> = {
  INVALID_EMAIL_OR_PASSWORD: 'credentials-rejected',
  INVALID_PASSWORD: 'credentials-rejected',
  USER_ALREADY_EXISTS: 'email-taken',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'email-taken',
  INVALID_EMAIL: 'email-malformed',
  PASSWORD_TOO_SHORT: 'password-length',
  PASSWORD_TOO_LONG: 'password-length',
}

/** What Better Auth answers when it says no: an error code, and a sentence for developers. */
const Refused = Schema.Struct({
  code: Schema.optionalKey(Schema.String),
  message: Schema.optionalKey(Schema.String),
})

/** The refusal an answer from Better Auth stands for, if it is one a user can act on. */
function refusalOf(status: number, answer: unknown): Refusal | undefined {
  if (status === 429) return 'too-many-attempts'
  const { code, message } = Option.getOrElse(Schema.decodeUnknownOption(Refused)(answer), () => ({
    code: undefined,
    message: undefined,
  }))
  // A malformed email fails Better Auth's input schema, whose message alone names the field.
  if (code === 'VALIDATION_ERROR') {
    return message?.startsWith('[body.email]') === true ? 'email-malformed' : undefined
  }
  return code === undefined ? undefined : refusals[code]
}

/** What signing up or in answers: the user, signed in. */
const SignedIn = Schema.Struct({ user: Schema.Struct({ id: Schema.String, email: Schema.String }) })

const decodeSignedIn = Schema.decodeUnknownEffect(SignedIn)

/** Passes on the cookies a call set, if any. */
const setCookies = (headers: Headers) =>
  Effect.gen(function* () {
    const cookies = headers.getSetCookie()
    if (cookies.length > 0) (yield* HttpExchange).setCookies(cookies)
  })

/** The request a credential endpoint is posted as: the client's headers, a JSON body. */
function credentialRequest(path: string, body: object, { url, headers }: HttpExchange['Service']) {
  const forwarded = new Headers(headers)
  forwarded.delete('content-length')
  forwarded.set('content-type', 'application/json')
  return new Request(new URL(`/api/auth${path}`, url), {
    method: 'POST',
    headers: forwarded,
    body: JSON.stringify(body),
  })
}

/** Better Auth, over the database, signing its cookies with `secret`. */
function betterAuthWith(secret: Redacted.Redacted, database: PromiseDatabase['Service']) {
  return betterAuth({
    secret: Redacted.value(secret),
    database: drizzleAdapter(database, {
      provider: 'pg',
      schema: { user, session, account, verification, rateLimit },
    }),
    emailAndPassword: { enabled: true },
    // Per client IP, in the database so every instance counts together: signing up or in allows 3
    // attempts in 10 seconds. The IP is `x-forwarded-for`, which Vercel sets and overwrites.
    rateLimit: { enabled: true, storage: 'database' },
    telemetry: { enabled: false },
  })
}

/** The Auth service over Better Auth, signing its cookies with `secret`. */
export const make = (secret: Redacted.Redacted) =>
  Effect.gen(function* () {
    const auth = betterAuthWith(secret, yield* PromiseDatabase)

    /** Posts credentials through Better Auth's handler, so its rate limiter and origin check run. */
    const credentialed = (path: string, body: object) =>
      Effect.gen(function* () {
        const request = credentialRequest(path, body, yield* HttpExchange)
        const response = yield* Effect.promise(() => auth.handler(request))
        yield* setCookies(response.headers)
        const answer: unknown = yield* Effect.promise(() => response.json())
        if (response.ok) return (yield* Effect.orDie(decodeSignedIn(answer))).user
        const reason = refusalOf(response.status, answer)
        if (reason === undefined) {
          return yield* Effect.die(new Error(`Better Auth answered ${String(response.status)}`))
        }
        return yield* new AuthRefused({ reason })
      })

    /** A call to Better Auth's server API with the request's headers; it refuses nothing a user did. */
    const exchanged = <A>(call: (headers: Headers) => Promise<{ headers: Headers; response: A }>) =>
      Effect.gen(function* () {
        const { headers: sent } = yield* HttpExchange
        const { headers, response } = yield* Effect.promise(() => call(sent))
        yield* setCookies(headers)
        return response
      })

    // Better Auth wants a name for its emails; IAM leaves it empty until Mapping copies the Root's Title.
    const signUp = ({ email, password }: Credentials) =>
      credentialed('/sign-up/email', { email, password, name: '' })
    const signIn = ({ email, password }: Credentials) =>
      credentialed('/sign-in/email', { email, password })
    const signOut = exchanged((headers) => auth.api.signOut({ headers, returnHeaders: true }))
    const current = exchanged((headers) => auth.api.getSession({ headers, returnHeaders: true }))
    return Auth.of({
      signUp,
      signIn,
      signOut: Effect.asVoid(signOut),
      session: Effect.map(current, (found) =>
        Option.map(Option.fromNullishOr(found), ({ user, session }) => ({
          user: { id: user.id, email: user.email },
          expiresAt: session.expiresAt,
        })),
      ),
    })
  })

/** The deployed Auth, over DATABASE_URL, its cookies signed with BETTER_AUTH_SECRET. */
export const layer = Layer.effect(Auth)(
  Effect.gen(function* () {
    return yield* make(yield* Config.Redacted('BETTER_AUTH_SECRET'))
  }),
).pipe(Layer.provide(promiseLayer))
