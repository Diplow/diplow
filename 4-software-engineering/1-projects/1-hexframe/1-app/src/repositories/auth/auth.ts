// The auth repository: Better Auth over the database, as one Auth service in Better Auth's own terms
// (a user, a session). IAM, above, turns them into its Accounts and Sessions. Better Auth has no route
// of its own: every call comes from a server function, and the cookies it reads and sets travel
// through HttpExchange. Signing up and in go through its request handler, where its rate limiter runs.
// Its api-key plugin keeps a user's API keys, IAM's Keys, and tells whose key a request's Bearer is.
import { apiKey } from '@better-auth/api-key'
import type { BetterAuthOptions } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { betterAuth } from 'better-auth/minimal'
import { Config, Context, Data, Effect, Layer, Option, Redacted, Schema } from 'effect'

import { PromiseDatabase, layer as promiseLayer } from '../database/promise'
import { account, apikey, rateLimit, session, user, verification } from '../database/schema'

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

/** A user's API key, as listed: never its secret, nor the hash kept of it. */
export interface AuthApiKey {
  readonly id: string
  readonly name: string
  /** Its first characters, the `hf_` prefix included, to tell it apart from the user's others. */
  readonly start: string
  readonly createdAt: Date
  /** When a request it proved was last verified, if one ever was. */
  readonly lastRequest: Date | null
}

/** An API key just created: the one time its secret is known, since only its hash is kept. */
export interface CreatedApiKey {
  readonly apiKey: AuthApiKey
  readonly secret: string
}

/** The user a request's `Authorization: Bearer` API key belongs to, and which key it was. */
export interface AuthBearer {
  readonly user: AuthUser
  readonly apiKeyId: string
}

/** Why Better Auth said no: the failures it reports that a user can act on. */
export type Refusal =
  | 'credentials-rejected'
  | 'email-taken'
  | 'email-malformed'
  | 'password-length'
  | 'too-many-attempts'
  | 'api-key-name-length'
  | 'api-key-not-found'

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
    /** Creates an API key, named, for the user the request's session cookie proves. */
    readonly createApiKey: (name: string) => Effect.Effect<CreatedApiKey, AuthRefused, HttpExchange>
    /** The API keys of the user the request's session cookie proves, the newest first. */
    readonly apiKeys: Effect.Effect<ReadonlyArray<AuthApiKey>, never, HttpExchange>
    /** Deletes one of the API keys of the user the request's session cookie proves. */
    readonly deleteApiKey: (id: string) => Effect.Effect<void, AuthRefused, HttpExchange>
    /** Whose API key the request's `Authorization: Bearer` header carries, if it is a valid one. */
    readonly bearer: Effect.Effect<Option.Option<AuthBearer>, never, HttpExchange>
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
  NAME_REQUIRED: 'api-key-name-length',
  INVALID_NAME_LENGTH: 'api-key-name-length',
  KEY_NOT_FOUND: 'api-key-not-found',
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

/** What Better Auth's server API throws when it says no: an `APIError`, its code in its body. */
const Thrown = Schema.Struct({ body: Schema.Struct({ code: Schema.optionalKey(Schema.String) }) })

/** The refusal a call to the server API failed with, or the defect it is when no user can act on it. */
const refusedOrDie = (thrown: unknown) => {
  const code = Option.getOrUndefined(
    Option.flatMap(Schema.decodeUnknownOption(Thrown)(thrown), ({ body }) =>
      Option.fromNullishOr(body.code),
    ),
  )
  const reason = code === undefined ? undefined : refusals[code]
  return reason === undefined ? Effect.die(thrown) : Effect.fail(new AuthRefused({ reason }))
}

const User = Schema.Struct({ id: Schema.String, email: Schema.String })

/** What signing up or in answers: the user, signed in. */
const SignedIn = Schema.Struct({ user: User })

const decodeSignedIn = Schema.decodeUnknownEffect(SignedIn)

/** An API key as the plugin answers it, its hash left out. A Key always has a name (`requireName`). */
const ListedApiKey = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  start: Schema.String,
  createdAt: Schema.Date,
  lastRequest: Schema.NullOr(Schema.Date),
})

/** What creating an API key answers: the key, its secret as `key`. */
const decodeCreated = Schema.decodeUnknownEffect(
  Schema.Struct({ ...ListedApiKey.fields, key: Schema.String }),
)

const decodeListed = Schema.decodeUnknownEffect(
  Schema.Struct({ apiKeys: Schema.Array(ListedApiKey) }),
)

/** What verifying an API key answers: whether it is valid, and then whose it is. */
const decodeVerified = Schema.decodeUnknownEffect(
  Schema.Struct({
    valid: Schema.Boolean,
    key: Schema.NullOr(Schema.Struct({ id: Schema.String, referenceId: Schema.String })),
  }),
)

const decodeUser = Schema.decodeUnknownEffect(Schema.NullOr(User))

/** An API key's secret: the `hf_` prefix, then 64 letters. Longer is not one, and is not hashed. */
const longestSecret = 128

/** The secret an `Authorization: Bearer` header carries, if it carries one; never a cookie's. */
function bearerOf(headers: Headers): Option.Option<string> {
  const [scheme = '', secret = '', ...rest] = (headers.get('authorization') ?? '').split(' ')
  const carried = scheme.toLowerCase() === 'bearer' && rest.length === 0
  return carried && secret !== '' && secret.length <= longestSecret
    ? Option.some(secret)
    : Option.none()
}

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

/**
 * Where Better Auth is reached: the hosts a request may name, which are also the origins it trusts,
 * and the URL any other host falls back to.
 */
export type BaseURL = Extract<NonNullable<BetterAuthOptions['baseURL']>, object>

/** The hosts a Vercel deployment answers on, as Vercel names them at runtime. */
export interface VercelHosts {
  readonly environment: string
  /** VERCEL_URL, the deployment's own: `hexframe-<hash>-<team>.vercel.app`. */
  readonly deployment: string
  /** VERCEL_BRANCH_URL, its branch's: `hexframe-app-git-<branch>-<team>.vercel.app`. */
  readonly branch: Option.Option<string>
  /** VERCEL_PROJECT_PRODUCTION_URL, the project's domain: `hexframe.ai`. */
  readonly production: string
}

/** Off Vercel: the dev server, the tests and a local build, on localhost whatever the port. */
export const localBaseURL: BaseURL = {
  allowedHosts: ['localhost', 'localhost:*'],
  fallback: 'http://localhost',
  protocol: 'http',
}

/**
 * A deployment's base URL: its own host and its branch's, and in production the project's domain,
 * which any other host falls back to. A preview falls back to its branch's URL. Off Vercel, localhost.
 */
export function baseURLOf(vercel: Option.Option<VercelHosts>): BaseURL {
  if (Option.isNone(vercel)) return localBaseURL
  const { environment, deployment, branch, production } = vercel.value
  const canonical =
    environment === 'production' ? production : Option.getOrElse(branch, () => deployment)
  return {
    allowedHosts: [...new Set([deployment, ...Option.toArray(branch), canonical])],
    fallback: `https://${canonical}`,
    protocol: 'https',
  }
}

/**
 * Vercel's system variables, when `VERCEL` says the app runs there; then each is required, but the
 * branch's URL, so a deployment missing one fails to start rather than answering on localhost only.
 */
export const vercelHosts = Effect.gen(function* () {
  if (Option.isNone(yield* Config.option(Config.String('VERCEL'))))
    return Option.none<VercelHosts>()
  return Option.some(
    yield* Config.all({
      environment: Config.String('VERCEL_ENV'),
      deployment: Config.String('VERCEL_URL'),
      branch: Config.option(Config.String('VERCEL_BRANCH_URL')),
      production: Config.String('VERCEL_PROJECT_PRODUCTION_URL'),
    }),
  )
})

/** Better Auth, over the database, signing its cookies with `secret`, reached at `baseURL`. */
function betterAuthWith(
  secret: Redacted.Redacted,
  baseURL: BaseURL,
  database: PromiseDatabase['Service'],
) {
  return betterAuth({
    secret: Redacted.value(secret),
    baseURL,
    database: drizzleAdapter(database, {
      provider: 'pg',
      schema: { user, session, account, verification, rateLimit, apikey },
    }),
    emailAndPassword: { enabled: true },
    // Per client IP, in the database so every instance counts together: signing up or in allows 3
    // attempts in 10 seconds. The IP is `x-forwarded-for`, which Vercel sets and overwrites.
    rateLimit: { enabled: true, storage: 'database' },
    plugins: [
      apiKey({
        defaultPrefix: 'hf_',
        requireName: true,
        // Its default, 10 verifications a day, would stop an MCP client within minutes.
        rateLimit: { enabled: false },
        keyExpiration: { defaultExpiresIn: null },
        // A key never becomes a session: the two proofs stay apart (src/api/CLAUDE.md, "/mcp").
        enableSessionForAPIKeys: false,
      }),
    ],
    telemetry: { enabled: false },
  })
}

/** The Auth service over Better Auth, signing its cookies with `secret`, reached at `baseURL`. */
export const make = (secret: Redacted.Redacted, baseURL: BaseURL) =>
  Effect.gen(function* () {
    const auth = betterAuthWith(secret, baseURL, yield* PromiseDatabase)

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

    /** A call to the server API for the request's session; a refusal a user can act on is kept. */
    const forSession = <A>(call: (headers: Headers) => Promise<A>) =>
      Effect.gen(function* () {
        const { headers } = yield* HttpExchange
        return yield* Effect.tryPromise({ try: () => call(headers), catch: (thrown) => thrown })
      }).pipe(Effect.catch(refusedOrDie))

    const createApiKey = (name: string) =>
      forSession((headers) => auth.api.createApiKey({ body: { name }, headers })).pipe(
        Effect.flatMap((created) => Effect.orDie(decodeCreated(created))),
        Effect.map(({ key, ...apiKey }) => ({ apiKey, secret: key })),
      )

    const apiKeys = forSession((headers) =>
      auth.api.listApiKeys({ query: { sortBy: 'createdAt', sortDirection: 'desc' }, headers }),
    ).pipe(
      Effect.flatMap((listed) => Effect.orDie(decodeListed(listed))),
      Effect.map((listed) => listed.apiKeys),
      Effect.orDie,
    )

    const deleteApiKey = (id: string) =>
      Effect.asVoid(
        forSession((headers) => auth.api.deleteApiKey({ body: { keyId: id }, headers })),
      )

    /** Verifies the Bearer's API key, then reads its user: the key's row names the user, not more. */
    const bearer = Effect.gen(function* () {
      const secret = bearerOf((yield* HttpExchange).headers)
      if (Option.isNone(secret)) return Option.none<AuthBearer>()
      const verified = yield* Effect.promise(() =>
        auth.api.verifyApiKey({ body: { key: secret.value } }),
      ).pipe(Effect.flatMap((answer) => Effect.orDie(decodeVerified(answer))))
      if (!verified.valid || verified.key === null) return Option.none<AuthBearer>()
      const { id, referenceId } = verified.key
      const context = yield* Effect.promise(() => auth.$context)
      const found = yield* Effect.promise(() => context.internalAdapter.findUserById(referenceId))
      const owner = yield* Effect.orDie(decodeUser(found))
      return Option.map(Option.fromNullishOr(owner), (user) => ({ user, apiKeyId: id }))
    })

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
      createApiKey,
      apiKeys,
      deleteApiKey,
      bearer,
    })
  })

/**
 * The deployed Auth, over DATABASE_URL, its cookies signed with BETTER_AUTH_SECRET, reached on the
 * hosts Vercel names.
 */
export const layer = Layer.effect(Auth)(
  Effect.gen(function* () {
    const secret = yield* Config.Redacted('BETTER_AUTH_SECRET')
    return yield* make(secret, baseURLOf(yield* vercelHosts))
  }),
).pipe(Layer.provide(promiseLayer))
