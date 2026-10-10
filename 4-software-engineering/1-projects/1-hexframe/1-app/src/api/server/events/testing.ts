// What the Turn's tests share: the app's three doors a sandbox reaches, `/mcp`, the model proxy and
// the Turn's events, served over HTTP on this machine, so a Turn's launcher and the fake agent in the
// sandbox on this machine reach them as a real sandbox reaches a deployment; and an Account signed up
// in a browser of its own, its requests reaching the app at that server's origin.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'

import { Exit, Option } from 'effect'

import * as Iam from '#/domains/iam/iam'
import { browser } from '#/repositories/auth/testing'

import { serveMcp } from '../mcp/mcp'
import { value } from '../mcp/testing'
import { serveModelCall } from '../proxy/proxy'
import { noKey, run, type StartContext } from '../run'
import { serveTurnEvent } from './events'

/** The model proxy's base path, the path after it the endpoint. */
const proxy = '/assistant/anthropic'

/** A request as the doors take it, from what Node's server received. */
async function requestOf(incoming: IncomingMessage, origin: string): Promise<Request> {
  const chunks: Array<Buffer> = []
  for await (const chunk of incoming) chunks.push(chunk as Buffer)
  const headers = new Headers()
  for (const [name, given] of Object.entries(incoming.headers)) {
    for (const one of [given ?? []].flat()) headers.append(name, one)
  }
  const method = incoming.method ?? 'GET'
  const body = method === 'GET' || method === 'HEAD' ? undefined : Buffer.concat(chunks)
  return new Request(new URL(incoming.url ?? '/', origin), { method, headers, body })
}

/** The door a path reaches, or none. */
function served(request: Request): Promise<Response> {
  const { pathname } = new URL(request.url)
  if (pathname === '/mcp') return serveMcp(request)
  if (pathname === '/assistant/events') return serveTurnEvent(request)
  if (pathname.startsWith(`${proxy}/`)) {
    return serveModelCall(request, pathname.slice(proxy.length))
  }
  return Promise.resolve(new Response(null, { status: 404 }))
}

async function answer(incoming: IncomingMessage, outgoing: ServerResponse, origin: string) {
  const response = await served(await requestOf(incoming, origin))
  outgoing.writeHead(response.status, Object.fromEntries(response.headers))
  outgoing.end(Buffer.from(await response.arrayBuffer()))
}

/** The doors served on a port of this machine; `close` stops them. */
export async function doorsServed(): Promise<{ origin: string; close: () => Promise<void> }> {
  let origin = ''
  const server = createServer((incoming, outgoing) => {
    answer(incoming, outgoing, origin).catch(() => {
      outgoing.writeHead(500).end()
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`
  const close = () =>
    new Promise<void>((resolve) => {
      server.closeAllConnections()
      server.close(() => {
        resolve()
      })
    })
  return { origin, close }
}

/**
 * Someone signed up with this email, in a browser of their own whose requests reach the app at
 * `origin`, and a request their Session proves, which collects the work it hands to `waitUntil`.
 */
export async function signedUpAt(origin: string, email: string) {
  const device = browser()
  const pending: Array<Promise<unknown>> = []
  const context = (): StartContext => ({
    requestId: 'req-turn',
    scope: 'test',
    waitUntil: (promise) => void pending.push(promise),
    exchange: { ...device.exchange(), url: `${origin}/_serverFn` },
    session: Exit.succeed(Option.none()),
    key: noKey,
  })
  await value(run(context(), Iam.signUp({ email, password: 'lovelace1815' })))
  const session = await value(run(context(), Iam.proven))
  const signedIn: StartContext = { ...context(), session: Exit.succeed(session) }
  const { account } = await value(run(signedIn, Iam.signedIn))
  /** Waits for the work the requests so far handed to `waitUntil`. */
  const waited = () => Promise.all(pending.splice(0))
  return { signedIn, accountId: account.id, waited }
}
