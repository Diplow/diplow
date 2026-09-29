/** Whether the /dev pages are served: in `pnpm dev` and on Vercel previews. Set in vite.config.ts. */
declare const __DEV_PAGES__: boolean

/** Where the app runs: `pnpm dev`, a Vercel preview, or production (a local build too). Set in vite.config.ts. */
declare const __ENVIRONMENT__: 'development' | 'preview' | 'production'

interface ImportMetaEnv {
  /** Sentry's DSN, public by design: where both sides send their errors. Sentry is off without it. */
  readonly VITE_SENTRY_DSN?: string
  /** PostHog's project key, public by design, and its host. PostHog is off without both. */
  readonly VITE_POSTHOG_KEY?: string
  readonly VITE_POSTHOG_HOST?: string
}
