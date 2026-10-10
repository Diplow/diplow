// An Entitlement: something an Account may do, derived when asked, never stored. Pure.
import { Schema } from 'effect'

/** Something an Account may do: for now, use the Assistant. */
export const Entitlement = Schema.Literal('assistant')

export type Entitlement = typeof Entitlement.Type
