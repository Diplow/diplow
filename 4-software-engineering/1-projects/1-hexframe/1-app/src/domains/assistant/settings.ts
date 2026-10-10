// The Assistant's settings: one value for every Account, in one place, until credits exist. A limit is
// read from here, never spread as a constant in code.
import { Duration } from 'effect'

export const settings = {
  turn: {
    /** The longest a Turn runs, and so the longest its Key proves it: 15 minutes. */
    longest: Duration.toMillis(Duration.minutes(15)),
  },
} as const
