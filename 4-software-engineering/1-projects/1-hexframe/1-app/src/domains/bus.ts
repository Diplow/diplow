// The server bus as a domain sees it: where it publishes a fact other parts may react to, without
// knowing who does. It sits beside the domains, not in one, like kind.ts. The API layer builds it and
// wires who reacts (src/api/server/bus.ts): a domain publishes, it never subscribes.
import { Context, type Effect } from 'effect'

/**
 * A fact in the past tense, declared by the domain that emits it, in its language, as an Effect Schema
 * tagged class: `class AccountCreated extends Schema.TaggedClass<AccountCreated>()('AccountCreated', …)`.
 * It never says who acted: the API layer puts that on the envelope it carries the event in.
 */
export interface DomainEvent {
  readonly _tag: string
}

/**
 * Publishes a fact. It neither fails nor waits for a subscriber: a caller that needs a result calls
 * directly, since the bus is never a way to ask. Published inside a transaction, it reaches
 * subscribers once that commits, and never when it rolls back.
 */
export class Bus extends Context.Service<
  Bus,
  { readonly publish: (event: DomainEvent) => Effect.Effect<void> }
>()('hexframe/Bus') {}
