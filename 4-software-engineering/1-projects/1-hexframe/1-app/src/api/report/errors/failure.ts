// The failures a server function can send, as one Effect Schema union: the server encodes by it, the
// client decodes by it back into the tagged classes. Shared by both sides, so nothing here is Effect's
// runtime: only schemas and plain data.
import { Option, Schema } from 'effect'

import { iamFailures } from '#/domains/iam/errors'
import { mappingFailures } from '#/domains/mapping/errors'

import { devFailures } from '../../dev/failures'

/**
 * A failure the server does not show as it is: a defect, a repository or infrastructure error, or an
 * error no schema here knows. Reported with the request id; the client sees only its kind.
 */
export class Unexpected extends Schema.TaggedError<Unexpected>()('Unexpected', {
  kind: Schema.tag('Unexpected'),
}) {}

/**
 * Every failure a server function may end with. A domain's errors join the union as the domain is
 * built; the server function helper refuses, by its type, a program failing with one missing here.
 */
export const Failure = Schema.Union([
  Unexpected,
  ...iamFailures,
  ...mappingFailures,
  ...devFailures,
])
export type Failure = typeof Failure.Type

/** A failure as it crosses the wire: plain data, narrowed to the failures `E` lists. */
export type EncodedFailure<E extends Failure> = Extract<
  typeof Failure.Encoded,
  { readonly _tag: E['_tag'] }
>

/**
 * What a server function run by the helper returns: its value, or its failure encoded with the id of
 * the request, so a report can be traced. Its type lists the failures the function can end with.
 */
export type Outcome<A, E extends Failure> =
  | { readonly ok: true; readonly value: A }
  | { readonly ok: false; readonly failure: EncodedFailure<E>; readonly requestId: string }

const encode = Schema.encodeSync(Failure)

/** The failure as plain data, for the wire. */
export function encodeFailure<E extends Failure>(failure: E): EncodedFailure<E> {
  // encodeSync returns the union's encoded side; each member encodes to its own tag, so it is E's.
  return encode(failure) as EncodedFailure<E>
}

const decode = Schema.decodeUnknownOption(Failure)

/**
 * The failure back as its tagged class. Anything the union does not know (a server a deploy ahead,
 * a malformed body) is `Unexpected`: the client never guesses a kind.
 */
export function decodeFailure(encoded: unknown): Failure {
  return Option.getOrElse(decode(encoded), () => new Unexpected())
}
