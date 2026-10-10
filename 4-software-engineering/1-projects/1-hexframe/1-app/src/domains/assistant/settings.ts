// The Assistant's settings: one value for every Account, in one place, until credits exist. A limit is
// read from here, never spread as a constant in code.
import { Duration } from 'effect'

/**
 * The kinds of token a model call is priced by: input read from no cache, output, input written to
 * the cache for five minutes or for an hour, and input read from it.
 */
export type TokenKind = 'input' | 'output' | 'cacheWrite5m' | 'cacheWrite1h' | 'cacheRead'

/** A model's price per kind of token, in dollars per million, which is millionths of a dollar each. */
type Price = Readonly<Record<TokenKind, number>>

export const settings = {
  turn: {
    /** The longest a Turn runs, and so the longest its Key proves it: 15 minutes. */
    longest: Duration.toMillis(Duration.minutes(15)),
    /** The most a Turn spends on the model, in millionths of a dollar: $1. */
    ceiling: 1_000_000,
  },
  month: {
    /**
     * The most an Account's Turns spend on the model in a calendar month, UTC, in millionths of a
     * dollar: $10, until credits exist.
     */
    allowance: 10_000_000,
  },
  model: {
    /**
     * The models a Turn's agent may call, each at its price: Sonnet 5.5, which the Turn works with,
     * and Haiku 4.5, the small model Claude Code does its own chores with.
     */
    prices: {
      'claude-sonnet-5-5': {
        input: 2,
        output: 10,
        cacheWrite5m: 2.5,
        cacheWrite1h: 4,
        cacheRead: 0.2,
      },
      'claude-haiku-4-5': {
        input: 1,
        output: 5,
        cacheWrite5m: 1.25,
        cacheWrite1h: 2,
        cacheRead: 0.1,
      },
    } satisfies Record<string, Price>,
    /** The most tokens a call may answer: a call asking for more is sent asking for this many. */
    maxTokens: 32_000,
    /** The most characters a call's body holds, Anthropic's own limit on a request. */
    largestCall: 32 * 1024 * 1024,
    /**
     * The fields a call's body may hold, every other refused: no `mcp_servers`, no `container`, no
     * `fallbacks`, no `speed`, nothing that reaches past the model or changes its price.
     */
    fields: [
      'model',
      'messages',
      'system',
      'tools',
      'tool_choice',
      'max_tokens',
      'metadata',
      'stream',
      'temperature',
      'stop_sequences',
      'thinking',
      'output_config',
      'context_management',
    ],
    /**
     * The betas a call may name in `anthropic-beta`, every other refused: Claude Code's own, and
     * those that change neither what the model reaches nor its price.
     */
    betas: [
      'claude-code-20250219',
      'interleaved-thinking-2025-05-14',
      'context-management-2025-06-27',
      'effort-2025-11-24',
      'prompt-caching-scope-2026-01-05',
      'extended-cache-ttl-2025-04-11',
      'token-counting-2024-11-01',
      'structured-outputs-2025-12-15',
      'mid-conversation-system-2026-04-07',
      'thinking-display-updates-2026-08-18',
      'redact-thinking-2026-02-12',
    ],
  },
} as const
