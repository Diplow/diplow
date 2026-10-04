import { Effect, Exit, Option, Schema } from 'effect'
import { describe, expect, it } from 'vitest'

import * as Iam from '#/domains/iam/iam'
import { browser, keyClient } from '#/repositories/auth/testing'

import type { Failure } from '../errors/failure'
import { noKey, run, type Services, type StartContext } from '../server/run'
import { Credentials, KeyId, KeyName } from './iam'

// IAM's server functions, as their handlers run them: the domain's operation, through the helper, on
// the runtime's Better Auth, over PGlite. Each device is a browser of its own, with its own IP, so
// Better Auth's rate limiter counts its attempts apart. Start's validation runs before a handler; the
// schema is checked on its own below.

type Device = ReturnType<typeof browser>

/** A request with no Session on it; a device's cookies travel with its calls. */
const signedOut: StartContext = {
  requestId: 'req-iam',
  scope: 'test',
  waitUntil: () => undefined,
  exchange: {
    url: 'http://localhost/_serverFn',
    headers: new Headers(),
    setCookies: () => undefined,
  },
  session: Exit.succeed(Option.none()),
  key: noKey,
}

/** Any of IAM's programs, as the helper takes it. */
type Program<A = unknown> = Effect.Effect<A, Failure, Services>

/** Runs a handler's program from a device, its cookies sent and the ones it sets kept. */
const from = <A>(device: Device, program: Program<A>, context = signedOut) =>
  run(context, device.request(program))

/** The value of a call that must succeed. */
async function value<A>(outcome: Promise<{ ok: true; value: A } | { ok: false }>): Promise<A> {
  const settled = await outcome
  if (!settled.ok) throw new Error(`Expected a success, got ${JSON.stringify(settled)}`)
  return settled.value
}

/** A request from the device, with the Session its cookie proves, as the middleware puts it on. */
async function requestFrom(device: Device): Promise<StartContext> {
  const session = await value(from(device, Iam.proven))
  return { ...signedOut, session: Exit.succeed(session) }
}

const credentials = (password = 'lovelace1815') => ({
  email: `${crypto.randomUUID()}@example.com`,
  password,
})

describe("IAM's server functions", () => {
  it('session sends SignedOut to nobody', async () => {
    expect(await run(signedOut, Iam.sessionOnly)).toEqual({
      ok: false,
      failure: { _tag: 'SignedOut', kind: 'Unauthenticated' },
      requestId: 'req-iam',
    })
  })

  it('signs up, and the Session its cookie proves is the new Account’s', async () => {
    const device = browser()
    const account = await value(from(device, Iam.signUp(credentials())))
    expect(device.cookies()).not.toHaveLength(0)
    const session = await value(run(await requestFrom(device), Iam.sessionOnly))
    expect(session.account).toEqual(account)
  })

  it('signs in on another device, and signs out there alone', async () => {
    const signedUp = credentials()
    const laptop = browser()
    const phone = browser()
    const account = await value(from(laptop, Iam.signUp(signedUp)))
    expect(await value(from(phone, Iam.signIn(signedUp)))).toEqual(account)

    await value(from(phone, Iam.signOut, await requestFrom(phone)))
    expect(await run(await requestFrom(phone), Iam.sessionOnly)).toMatchObject({
      ok: false,
      failure: { _tag: 'SignedOut' },
    })
    expect(await value(run(await requestFrom(laptop), Iam.sessionOnly))).toMatchObject({ account })
  })

  it('sends a refusal as its tagged error, on the field at fault, with the request id', async () => {
    const taken = credentials()
    await value(from(browser(), Iam.signUp(taken)))
    const refusals: ReadonlyArray<readonly [Program, object]> = [
      [Iam.signUp(taken), { _tag: 'EmailTaken', kind: 'Invalid', fields: ['email'] }],
      [
        Iam.signUp({ ...credentials(), email: 'not an email' }),
        { _tag: 'EmailMalformed', fields: ['email'] },
      ],
      [Iam.signUp(credentials('short')), { _tag: 'PasswordLengthInvalid', fields: ['password'] }],
    ]
    for (const [program, failure] of refusals) {
      expect(await from(browser(), program)).toMatchObject({
        ok: false,
        failure,
        requestId: 'req-iam',
      })
    }
  })

  it('rejects a wrong password and an unknown email alike, on the password', async () => {
    const known = credentials()
    await value(from(browser(), Iam.signUp(known)))
    const rejected = { _tag: 'CredentialsRejected', kind: 'Invalid', fields: ['password'] }
    expect(await from(browser(), Iam.signIn({ ...known, password: 'not-the-one' }))).toMatchObject({
      ok: false,
      failure: rejected,
    })
    expect(await from(browser(), Iam.signIn(credentials()))).toMatchObject({
      ok: false,
      failure: rejected,
    })
  })
})

describe("IAM's Key server functions", () => {
  /** A device signed in as a new Account, and a request from it as the middleware puts it on. */
  async function signedInDevice() {
    const device = browser()
    const account = await value(from(device, Iam.signUp(credentials())))
    return { device, account, request: await requestFrom(device) }
  }

  it('issues, lists and revokes a Key; only the issue carries its secret', async () => {
    const { device, request } = await signedInDevice()
    const issued = await value(from(device, Iam.issueKey('Claude Code'), request))
    expect(issued.secret).toMatch(/^hf_/)
    const listed = await value(from(device, Iam.keys, request))
    expect(listed).toEqual([issued.key])
    expect(JSON.stringify(listed)).not.toContain(issued.secret)

    await value(from(device, Iam.revokeKey(issued.key.id), request))
    expect(await value(from(device, Iam.keys, request))).toEqual([])
  })

  it('sends SessionRequired over the wire to a request a Key proves', async () => {
    const { device, account, request } = await signedInDevice()
    const { secret } = await value(from(device, Iam.issueKey('leaked'), request))
    const key = await value(run(signedOut, keyClient(secret).request(Iam.keyProven)))
    expect(key).toMatchObject(Option.some({ account }))
    const byKey: StartContext = { ...signedOut, key: Exit.succeed(key) }
    const sessionOnly: ReadonlyArray<Program> = [Iam.issueKey('another'), Iam.keys, Iam.sessionOnly]
    for (const program of sessionOnly) {
      expect(await run(byKey, program)).toEqual({
        ok: false,
        failure: { _tag: 'SessionRequired', kind: 'Forbidden' },
        requestId: 'req-iam',
      })
    }
  })

  it('sends KeyNameInvalid on the name, and KeyNotFound for a Key that is not theirs', async () => {
    const { device, request } = await signedInDevice()
    expect(await from(device, Iam.issueKey(''), request)).toMatchObject({
      ok: false,
      failure: { _tag: 'KeyNameInvalid', kind: 'Invalid', fields: ['name'] },
    })
    expect(await from(device, Iam.revokeKey('nosuchkey'), request)).toMatchObject({
      ok: false,
      failure: { _tag: 'KeyNotFound', kind: 'NotFound' },
    })
  })
})

describe('the schemas issuing and revoking a Key validate by', () => {
  it('bound the name to 256 characters, a string', () => {
    expect(Schema.is(KeyName)({ name: 'x'.repeat(256) })).toBe(true)
    expect(Schema.is(KeyName)({ name: 'x'.repeat(257) })).toBe(false)
    expect(Schema.is(KeyName)({ name: 1 })).toBe(false)
  })

  it('take an id of letters and digits only', () => {
    expect(Schema.is(KeyId)({ id: 'aB3dEf9hIjKlMnOpQrStUvWxYz012345' })).toBe(true)
    for (const id of ['', '../x', 'a b', 'x'.repeat(129)]) {
      expect(Schema.is(KeyId)({ id })).toBe(false)
    }
  })
})

describe('the schema sign-up and sign-in validate by', () => {
  const accepts = (input: unknown) => Schema.is(Credentials)(input)
  const email = (length: number) => `${'x'.repeat(length - '@example.com'.length)}@example.com`

  it('bound the email to 320 characters and the password to 1,024', () => {
    expect(accepts({ email: email(320), password: 'x'.repeat(1_024) })).toBe(true)
    expect(accepts({ email: email(321), password: 'lovelace1815' })).toBe(false)
    expect(accepts({ email: email(320), password: 'x'.repeat(1_025) })).toBe(false)
  })

  it('take strings only, both of them', () => {
    expect(accepts({ email: email(20) })).toBe(false)
    expect(accepts({ email: email(20), password: 1815 })).toBe(false)
  })
})
