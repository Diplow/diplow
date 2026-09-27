// What kind of failure a domain's error is: the closed set the client picks a channel by. A domain
// declares its errors as tagged classes in its own language, each carrying one kind as a field, so the
// kind travels with the error and the client needs nothing else to route it (src/api/CLAUDE.md).
import { Schema } from 'effect'

/** Every kind, in the order the channel table reads them. */
export const kinds = [
  'Unauthenticated',
  'Forbidden',
  'Invalid',
  'NotFound',
  'Conflict',
  'Unexpected',
] as const

export type Kind = (typeof kinds)[number]

/**
 * The `kind` field of a domain's error: `kind: kind('Conflict')`. `Invalid` names its fields, so it
 * has `invalid` instead, and `Unexpected` is no domain's to declare: the server function helper turns
 * every failure it does not know, and every defect, into one.
 */
export const kind = <K extends Exclude<Kind, 'Invalid' | 'Unexpected'>>(value: K) =>
  Schema.tag(value)

/**
 * The fields of an `Invalid` error, spread into its own: the kind, and the form fields at fault, by
 * name. Each field shows the error's message from the message table, never the server's sentence.
 */
export const invalid = {
  kind: Schema.tag('Invalid'),
  fields: Schema.NonEmptyArray(Schema.String),
}
