import type { IConfiguration } from 'dependency-cruiser'

// Layers, top to bottom: routes → features → API → domains → repositories. An import only ever
// points down. A feature is client code a route composes: it reaches the server through src/api/.
const layers = ['routes', 'features', 'api', 'domains', 'repositories']

// Each third-party SDK is imported by its repository alone; the rest of the app sees it through that seam.
const sdks = {
  database: [
    'drizzle-orm',
    '@effect/sql-(pg|pglite)',
    'pg',
    '@electric-sql/pglite',
    '@neondatabase/.+',
  ],
  auth: ['better-auth', '@better-auth/.+', 'stripe'],
}

// The UI libraries behind the design system: only src/ui/ imports them, and a feature builds from ui/.
const uiLibraries = [
  'radix-ui',
  '@radix-ui/.+',
  '@tanstack/react-table',
  '@tanstack/react-form',
  '@tanstack/table-core',
  '@tanstack/(react-)?hotkeys',
  '@tanstack/(react-)?markdown',
  'sonner',
]

const upwardImports: IConfiguration['forbidden'] = layers.slice(1).map((layer, index) => ({
  name: `no-${layer}-importing-up`,
  comment: `${layer} sits below ${layers.slice(0, index + 1).join(', ')} and never imports them.`,
  severity: 'error',
  from: { path: `^src/${layer}/` },
  to: { path: `^src/(${layers.slice(0, index + 1).join('|')})/` },
}))

const sdkOutsideItsRepository: IConfiguration['forbidden'] = Object.entries(sdks).map(
  ([repository, modules]) => ({
    name: `no-${repository}-sdk-outside-its-repository`,
    comment: `${modules.join(', ')}: imported by src/repositories/${repository}/ only.`,
    severity: 'error',
    from: { pathNot: `^src/repositories/${repository}/` },
    // Resolved into node_modules once installed; a bare name while it is not.
    to: { path: `(^|node_modules/)(${modules.join('|')})(/|$)` },
  }),
)

const config: IConfiguration = {
  forbidden: [
    ...upwardImports,
    {
      name: 'no-routes-or-features-importing-domains-or-repositories',
      comment: 'A route or a feature reaches the server through a server function in src/api/.',
      severity: 'error',
      from: { path: '^src/(routes|features)/' },
      to: { path: '^src/(domains|repositories)/' },
    },
    {
      name: 'no-feature-importing-another',
      comment:
        'Sibling features ignore each other; a route composes them, the client bus links them.',
      severity: 'error',
      from: { path: '^src/features/([^/]+)/' },
      to: { path: '^src/features/([^/]+)/', pathNot: '^src/features/$1/' },
    },
    {
      name: 'no-domain-importing-another',
      comment: 'Domains ignore each other; only the API layer composes them.',
      severity: 'error',
      from: { path: '^src/domains/([^/]+)/' },
      to: { path: '^src/domains/([^/]+)/', pathNot: '^src/domains/$1/' },
    },
    ...sdkOutsideItsRepository,
    {
      name: 'no-ui-library-outside-ui',
      comment: `${uiLibraries.join(', ')}: imported by src/ui/ only; a feature builds from its components.`,
      severity: 'error',
      from: { pathNot: '^src/ui/' },
      to: { path: `(^|node_modules/)(${uiLibraries.join('|')})(/|$)` },
    },
    {
      name: 'no-zod',
      comment:
        'Validation is Effect Schema, everywhere; this catches static, dynamic and require imports alike.',
      severity: 'error',
      from: {},
      to: { path: '(^|node_modules/)zod(/|$)' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '^src/paraglide/' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
  },
}

export default config
