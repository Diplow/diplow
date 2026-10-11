// The client bus: a fact one feature publishes and a sibling reacts to, since features may not import
// each other. It sits beside the features, not in one, so both sides reach it. A fact crossing into
// the client from outside (the server, storage) is decoded by its schema before any feature sees it;
// between features, in one page, its type is enough.
import { Option, Schema } from 'effect'
import { useCallback, useSyncExternalStore } from 'react'

import { log, reportError } from '#/api/report/observability/client'

/**
 * A fact in the past tense, declared with an Effect Schema tagged class in the language of the domain
 * it speaks of: `class TileCentered extends Schema.TaggedClass<TileCentered>()('TileCentered', …)`.
 */
export interface Fact {
  readonly _tag: string
}

/** A fact's schema: what a subscriber matches, and what a fact from outside is decoded by. */
type FactSchema<F extends Fact> = Schema.Codec<F, unknown>

const listeners = new Set<(fact: Fact) => void>()

// A bus message is logged at `medium`, by its tag, never its fields.
function logged(fact: Fact) {
  log('bus', `${fact._tag} published`, { bus: 'client' })
}

/**
 * Tells every subscribed feature about a fact. Nothing answers: the bus is never a way to ask. A
 * feature that throws while reacting is reported, and the others still hear the fact.
 */
export function publish(fact: Fact) {
  logged(fact)
  for (const listener of listeners) {
    try {
      listener(fact)
    } catch (error) {
      reportError(error, { scope: fact._tag })
    }
  }
}

/**
 * Publishes a fact that crosses into the client, once its schema decodes it. One that does not
 * decode is dropped and reported: no feature ever sees a fact its schema refuses.
 */
export function receive<F extends Fact>(schema: FactSchema<F>, input: unknown) {
  const fact = Schema.decodeUnknownOption(schema)(input)
  if (Option.isSome(fact)) publish(fact.value)
  else reportError(new Error('The client bus dropped a fact its schema refuses'), { scope: 'bus' })
}

function listen<F extends Fact>(schema: FactSchema<F>, react: (fact: F) => void) {
  const accepts = Schema.is(schema)
  const listener = (fact: Fact) => {
    if (accepts(fact)) react(fact)
  }
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const nothing = () => undefined

/**
 * Calls `react` with every fact `schema` accepts, for as long as the component is mounted. A state
 * hook passes one of its actions. React subscribes through `useSyncExternalStore`, its hook for a
 * source outside React, which never re-renders here: the snapshot is always the same.
 */
export function useFact<F extends Fact>(schema: FactSchema<F>, react: (fact: F) => void) {
  const subscribe = useCallback(() => listen(schema, react), [schema, react])
  useSyncExternalStore(subscribe, nothing, nothing)
}
