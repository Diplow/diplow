import type { IConfiguration } from 'dependency-cruiser'

// Layers, top to bottom: routes → API → domains → repositories. An import only ever points down.
const layers = ['routes', 'api', 'domains', 'repositories']

// Each third-party SDK is imported by its repository alone; the rest of the app sees it through that seam.
const sdks = {
  database: ['drizzle-orm', '@effect/sql-drizzle', '@neondatabase/.+'],
  auth: ['better-auth', '@better-auth/.+', 'stripe'],
}

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
      name: 'no-routes-importing-domains-or-repositories',
      comment: 'A route reaches the server through a server function in src/api/.',
      severity: 'error',
      from: { path: '^src/routes/' },
      to: { path: '^src/(domains|repositories)/' },
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
