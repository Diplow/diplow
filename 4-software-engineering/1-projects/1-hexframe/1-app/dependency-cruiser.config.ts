import type { IConfiguration } from 'dependency-cruiser'

// Layers, top to bottom: front → API → domains → repositories. An import only ever points down, so
// nothing below the front, the API layer included, can reach what the browser shows. The front is
// the client: routes, the features they compose, the client's side of the API and the design system;
// it reaches the server through src/api/. Each layer is a tier of one or more sibling folders.
const layers = [['front'], ['api'], ['domains'], ['repositories']]

// Inside the front, top to bottom: routes → features → the client's side of the API and the design
// system, side by side. A route composes features; neither a feature nor the design system imports
// a route, and neither the client nor the design system imports a feature.
const frontLayers = [['routes'], ['features'], ['client', 'ui']]

/** One rule per tier below the top: it never imports a tier above it. */
function upward(root: string, tiers: string[][]): NonNullable<IConfiguration['forbidden']> {
  return tiers.slice(1).map((tier, index) => {
    const above = tiers.slice(0, index + 1).flat()
    return {
      name: `no-${tier.join('-or-')}-importing-up`,
      comment: `${tier.join(' and ')} sit below ${above.join(', ')} and never import them.`,
      severity: 'error',
      from: { path: `^${root}(${tier.join('|')})/` },
      to: { path: `^${root}(${above.join('|')})/` },
    }
  })
}

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
  observability: ['@sentry/.+', 'posthog-js', 'posthog-node'],
}

// The UI libraries behind the design system: only src/front/ui/ imports them, and a feature builds from ui/.
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

// The MCP server's SDK is the API layer's framework at `/mcp`, as Start is for server functions: the
// one SDK a repository does not hold, imported by the API layer's MCP folder alone (STACK.md).
const mcpFolder = 'src/api/server/mcp/'

// The YAML serializer is no SDK: it reaches nothing outside the process. Mapping decides the files a
// System exports to and reads back, so the one folder that writes and reads them imports it.
const filesFolder = 'src/domains/mapping/files/'

// The shape (2-claude-mod/hooks/shape/), how a vault reads as a hexframe, written once for every
// medium: Mapping reads files by its rules, so Mapping alone imports it, and only its reading rules.
const shapeReadingRules = '2-claude-mod/hooks/shape/(node|exclusions)\\.ts$'

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
    ...upward('src/', layers),
    ...upward('src/front/', frontLayers),
    {
      name: 'no-front-importing-domains-or-repositories',
      comment: 'The front reaches the server through a server function in src/api/.',
      severity: 'error',
      from: { path: '^src/front/' },
      to: { path: '^src/(domains|repositories)/' },
    },
    {
      name: 'no-feature-importing-another',
      comment:
        'Sibling features ignore each other; a route composes them, the client bus links them.',
      severity: 'error',
      from: { path: '^src/front/features/([^/]+)/' },
      to: { path: '^src/front/features/([^/]+)/', pathNot: '^src/front/features/$1/' },
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
      name: 'no-mcp-sdk-outside-the-mcp-folder',
      comment: `@modelcontextprotocol/*: imported by ${mcpFolder} only.`,
      severity: 'error',
      from: { pathNot: `^${mcpFolder}` },
      to: { path: '(^|node_modules/)@modelcontextprotocol/' },
    },
    {
      name: 'no-yaml-outside-mapping-files',
      comment: `yaml: imported by ${filesFolder} only, where Mapping writes and reads its files.`,
      severity: 'error',
      from: { pathNot: `^${filesFolder}` },
      to: { path: '(^|node_modules/)yaml(/|$)' },
    },
    {
      name: 'no-shape-outside-mapping',
      comment:
        'The shape is imported by src/domains/mapping/ only, and only its reading rules, node.ts and exclusions.ts.',
      severity: 'error',
      from: { path: '^src/', pathNot: '^src/domains/mapping/' },
      to: { path: '2-claude-mod/' },
    },
    {
      name: 'no-claude-mod-but-the-shape-reading-rules',
      comment:
        'Of claude-mod, the app imports the shape’s reading rules, node.ts and exclusions.ts, only.',
      severity: 'error',
      from: { path: '^src/' },
      to: { path: '2-claude-mod/', pathNot: shapeReadingRules },
    },
    {
      name: 'no-promise-database-outside-auth',
      comment:
        "PromiseDatabase is for Better Auth's adapter, which awaits its queries; every other repository uses Database.",
      severity: 'error',
      from: { pathNot: '^src/repositories/(auth|database)/' },
      to: { path: '^src/repositories/database/promise\\.ts$' },
    },
    {
      name: 'no-ui-library-outside-ui',
      comment: `${uiLibraries.join(', ')}: imported by src/front/ui/ only; a feature builds from its components.`,
      severity: 'error',
      from: { pathNot: '^src/front/ui/' },
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
    exclude: { path: '^paraglide/' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
  },
}

export default config
