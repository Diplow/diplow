// The Accounts let into a paid feature by hand, by email, until Stripe says who pays for it: for now
// the Assistant alone, from ASSISTANT_ACCOUNTS, server-only, a comma-separated list of emails. IAM
// derives its Entitlements from it, when asked. Stripe's plugin takes its place here. No email is
// verified, so an email is listed only once its Account exists: one nobody has signed up with yet
// would go to whoever signs up with it first, while an email taken can't be signed up with again.
import { Config, Context, Effect, Layer } from 'effect'

/** A feature a user is let into by hand. */
export type Feature = 'assistant'

export class Allowlist extends Context.Service<
  Allowlist,
  {
    /** Whether the user of this email is let into the feature. */
    readonly allows: (feature: Feature, email: string) => boolean
  }
>()('hexframe/Allowlist') {}

/** An email as the list compares it: trimmed, in lower case. */
const normalized = (email: string) => email.trim().toLowerCase()

/** The allowlist of these emails per feature, compared trimmed and case-insensitively. */
export const allowing = (emails: Readonly<Record<Feature, ReadonlyArray<string>>>) => {
  const listed = {
    assistant: new Set(emails.assistant.map(normalized).filter((email) => email !== '')),
  }
  return Allowlist.of({ allows: (feature, email) => listed[feature].has(normalized(email)) })
}

/** The deployed allowlist, from ASSISTANT_ACCOUNTS: nobody is let in when it is unset or empty. */
export const layer = Layer.effect(Allowlist)(
  Effect.map(Config.withDefault(Config.String('ASSISTANT_ACCOUNTS'), ''), (assistant) =>
    allowing({ assistant: assistant.split(',') }),
  ),
).pipe(Layer.orDie)
