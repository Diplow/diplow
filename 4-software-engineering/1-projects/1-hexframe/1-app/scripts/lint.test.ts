// The lint rules that keep features on the design system, proved to fire: a regex that silently
// stops matching would leave `pnpm check` green while the rule it carries is gone.
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { cruise } from 'dependency-cruiser'
import { ESLint } from 'eslint'
import { beforeAll, describe, expect, it } from 'vitest'

import depcruise from '../dependency-cruiser.config'

const eslint = new ESLint({ cwd: join(import.meta.dirname, '..') })

// The file must exist for type-aware linting; its content is the one given here.
async function restrictedSyntax(code: string, filePath: string) {
  const [result] = await eslint.lintText(code, { filePath })
  return (result?.messages ?? [])
    .filter((message) => message.ruleId === 'no-restricted-syntax')
    .map((message) => message.message)
}

const feature = 'src/front/routes/index.tsx'
const inUi = 'src/front/ui/layouts/Dialog.tsx'
const colour = /theme token/

// The first type-aware lint builds the TypeScript program of the whole app, which takes seconds on a
// cold CI runner and grows with the app. Built once here, so each case below times only its own lint.
beforeAll(async () => {
  await eslint.lintText('', { filePath: feature })
}, 60_000)

describe('the colour lint', () => {
  it.each([
    'bg-zinc-900',
    'border-x-red-500/50',
    'hover:text-white',
    'ring-offset-black',
    '#fff',
    'bg-[#a1b2c3]',
    '#11223344',
  ])('refuses %s', async (literal) => {
    const code = `export const a = '${literal}'\nexport const b = \`p-2 ${literal}\`\n`
    const messages = await restrictedSyntax(code, feature)
    expect(messages).toHaveLength(2)
    expect(messages.every((message) => colour.test(message))).toBe(true)
  })

  it.each(['bg-background text-muted-foreground whitespace-nowrap', '#cafe', '#/front/ui/tokens'])(
    'lets %s through',
    async (literal) => {
      expect(await restrictedSyntax(`export const a = '${literal}'\n`, feature)).toEqual([])
    },
  )

  it('applies inside ui/ too', async () => {
    const messages = await restrictedSyntax(`export const a = 'text-white'\n`, inUi)
    expect(messages).toHaveLength(1)
  })
})

describe('the reduced motion lint', () => {
  it.each(['data-[state=open]:animate-in fade-in-0', 'data-[state=closed]:animate-out'])(
    'refuses %s without the reduced motion beside it',
    async (literal) => {
      const code = `export const a = '${literal}'\nexport const b = \`p-2 ${literal}\`\n`
      const messages = await restrictedSyntax(code, inUi)
      expect(messages).toHaveLength(2)
      expect(messages.every((message) => /reduced motion/.test(message))).toBe(true)
    },
  )

  it('lets it through with motion-reduce:animate-none! beside it', async () => {
    const code = `export const a = 'data-[state=open]:animate-in motion-reduce:animate-none!'\nexport const b = 'animate-in motion-reduce:animate-none'\n`
    expect(await restrictedSyntax(code, inUi)).toEqual([])
  })
})

describe('the raw element lint', () => {
  it.each(['table', 'dialog'])('refuses a <%s> outside ui/', async (element) => {
    const messages = await restrictedSyntax(`export const e = <${element} />\n`, feature)
    expect(messages).toEqual([
      `No raw <${element}> outside src/front/ui/: build from the design system's component.`,
    ])
  })

  it.each(['table', 'dialog'])('lets ui/ render a <%s>', async (element) => {
    expect(await restrictedSyntax(`export const e = <${element} />\n`, inUi)).toEqual([])
  })
})

describe('the effect hook lint', () => {
  const effect = /No useEffect outside src\/front\/ui\//

  it.each([
    "import { useEffect } from 'react'\nuseEffect(() => undefined)\n",
    "import { useLayoutEffect as run } from 'react'\nrun(() => undefined)\n",
    "import * as React from 'react'\nReact.useEffect(() => undefined)\n",
    "import * as R from 'react'\nR.useEffect(() => undefined)\n",
    "import * as React from 'react'\nReact['useEffect'](() => undefined)\n",
    "import * as React from 'react'\nconst { useEffect } = React\nuseEffect(() => undefined)\n",
  ])('refuses an effect hook outside ui/: %s', async (code) => {
    const messages = await restrictedSyntax(code, feature)
    expect(messages).toHaveLength(1)
    expect(messages.every((message) => effect.test(message))).toBe(true)
  })

  it('lets the other hooks through, and ui/ use effects', async () => {
    expect(await restrictedSyntax("import { useState } from 'react'\n", feature)).toEqual([])
    expect(await restrictedSyntax("import { useEffect } from 'react'\n", inUi)).toEqual([])
  })
})

describe('the Effect run lint', () => {
  const helper = 'src/api/server/run.ts'
  const run = /Only the server function helper/

  const runs = [
    "import { Effect } from 'effect'\nEffect.runPromise(Effect.void)\n",
    "import { Effect } from 'effect'\nEffect.runSyncExit(Effect.void)\n",
    "import { runFork } from 'effect/Effect'\nrunFork\n",
    'declare const runtime: { runPromiseExit: () => void }\nruntime.runPromiseExit()\n',
    "import { Effect } from 'effect'\nEffect['runSync'](Effect.void)\n",
    "import { Effect } from 'effect'\nconst { runFork } = Effect\nrunFork(Effect.void)\n",
  ]
  // A server function's file runs no program either: the helper does.
  const files = [feature, inUi, 'src/api/iam/iam.ts']

  it.each(files.flatMap((file) => runs.map((code) => [file, code] as const)))(
    'refuses a program run in %s: %s',
    async (file, code) => {
      const messages = await restrictedSyntax(code, file)
      expect(messages).toHaveLength(1)
      expect(messages.every((message) => run.test(message))).toBe(true)
    },
  )

  it('lets the helper run one, and the rest of Effect through', async () => {
    const code = "import { Effect } from 'effect'\nEffect.runPromise(Effect.void)\n"
    expect(await restrictedSyntax(code, helper)).toEqual([])
    const schema = "import { Schema } from 'effect'\nSchema.decodeUnknownSync(Schema.String)('')\n"
    expect(await restrictedSyntax(schema, feature)).toEqual([])
  })
})

describe('the UI library boundary', () => {
  // The rule is written with `from.pathNot` and `to.path`, one string each.
  const rule = depcruise.forbidden?.find(({ name }) => name === 'no-ui-library-outside-ui') as
    { from: { pathNot: string }; to: { path: string } } | undefined
  const to = new RegExp(rule?.to.path ?? '$^')
  const exempt = new RegExp(rule?.from.pathNot ?? '$^')

  it.each([
    'radix-ui',
    '@radix-ui/react-dialog',
    '@tanstack/react-table',
    '@tanstack/table-core',
    '@tanstack/react-form',
    '@tanstack/react-hotkeys',
    '@tanstack/markdown',
    'sonner',
    '../node_modules/.pnpm/radix-ui@1.6.7_x/node_modules/radix-ui/dist/index.js',
    '../node_modules/.pnpm/sonner@2.0.8/node_modules/sonner/dist/index.js',
  ])('holds back %s', (module) => {
    expect(to.test(module)).toBe(true)
  })

  it.each([
    'react',
    '@tanstack/react-router',
    '@tanstack/react-query',
    'lucide-react',
    'radix-uix',
  ])('lets %s through', (module) => {
    expect(to.test(module)).toBe(false)
  })

  it('exempts src/front/ui/ and nothing else', () => {
    expect(exempt.test('src/front/ui/canvas/layouts/Drawer.tsx')).toBe(true)
    expect(exempt.test('src/front/routes/index.tsx')).toBe(false)
  })
})

describe('the MCP SDK boundary', () => {
  const rule = depcruise.forbidden?.find(
    ({ name }) => name === 'no-mcp-sdk-outside-the-mcp-folder',
  ) as { from: { pathNot: string }; to: { path: string } } | undefined
  const to = new RegExp(rule?.to.path ?? '$^')
  const exempt = new RegExp(rule?.from.pathNot ?? '$^')

  it.each([
    '@modelcontextprotocol/server',
    '@modelcontextprotocol/client',
    '../node_modules/.pnpm/@modelcontextprotocol+server@2.3.0/node_modules/@modelcontextprotocol/server/dist/index.mjs',
  ])('holds back %s', (module) => {
    expect(to.test(module)).toBe(true)
  })

  it('exempts the API layer’s MCP folder and nothing else', () => {
    expect(exempt.test('src/api/server/mcp/mcp.ts')).toBe(true)
    expect(exempt.test('src/api/server/run.ts')).toBe(false)
    expect(exempt.test('src/api/mapping/programs.ts')).toBe(false)
    expect(exempt.test('src/front/routes/mcp.ts')).toBe(false)
  })
})

describe('the sandbox SDK boundary', () => {
  const rule = depcruise.forbidden?.find(
    ({ name }) => name === 'no-agent-sandbox-sdk-outside-its-repository',
  ) as { from: { pathNot: string }; to: { path: string } } | undefined
  const to = new RegExp(rule?.to.path ?? '$^')
  const exempt = new RegExp(rule?.from.pathNot ?? '$^')

  it.each([
    '@blaxel/core',
    '../node_modules/.pnpm/@blaxel+core@0.3.25/node_modules/@blaxel/core/dist/esm/index.js',
  ])('holds back %s', (module) => {
    expect(to.test(module)).toBe(true)
  })

  it('exempts the sandbox repository and nothing else, its agent/ sibling included', () => {
    expect(exempt.test('src/repositories/agent/sandbox/blaxel.ts')).toBe(true)
    expect(exempt.test('src/repositories/agent/anthropic/relay.ts')).toBe(false)
    expect(exempt.test('src/domains/assistant/assistant.ts')).toBe(false)
    expect(exempt.test('src/api/server/run.ts')).toBe(false)
  })
})

describe('the .ts import lint', () => {
  const tsImport = /No \.ts or \.tsx in an import path under src\//

  async function restrictedImports(code: string, filePath: string) {
    const [result] = await eslint.lintText(code, { filePath })
    return (result?.messages ?? [])
      .filter((message) => message.ruleId === 'no-restricted-imports')
      .map((message) => message.message)
  }

  it.each([
    "import { a } from './a.ts'\n",
    "import { a } from './a.tsx'\n",
    "import { a } from '#/api/server/run.ts'\n",
  ])('refuses %s under src/', async (code) => {
    const messages = await restrictedImports(code, feature)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatch(tsImport)
  })

  it('lets the migrations file, which Node runs, import with .ts', async () => {
    const code = "import { Database } from './database.ts'\n"
    expect(await restrictedImports(code, 'src/repositories/database/migrations.ts')).toEqual([])
  })
})

describe('the transaction lint', () => {
  const opens = "import { transactional } from '#/repositories/database/database'\n"

  async function restrictedImports(code: string, filePath: string) {
    const [result] = await eslint.lintText(code, { filePath })
    return (result?.messages ?? [])
      .filter((message) => message.ruleId === 'no-restricted-imports')
      .map((message) => message.message)
  }

  it.each(['src/domains/mapping/mapping.ts', 'src/domains/assistant/undo/undo.ts'])(
    'refuses a domain opening a transaction, in %s',
    async (filePath) => {
      const messages = await restrictedImports(opens, filePath)
      expect(messages).toHaveLength(1)
      expect(messages[0]).toMatch(/A domain never opens a transaction/)
    },
  )

  it('still refuses a .ts import path in a domain', async () => {
    const messages = await restrictedImports(
      "import { a } from './a.ts'\n",
      'src/domains/mapping/mapping.ts',
    )
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatch(/No \.ts or \.tsx in an import path/)
  })

  it.each([
    'src/domains/mapping/testing.ts',
    'src/domains/mapping/mapping.test.ts',
    'src/api/mapping/programs.ts',
  ])('lets test code and the API layer open one, in %s', async (filePath) => {
    expect(await restrictedImports(opens, filePath)).toEqual([])
  })

  it('lets a domain name the transaction it needs', async () => {
    const code = "import type { InTransaction } from '#/repositories/database/database'\n"
    expect(await restrictedImports(code, 'src/domains/mapping/mapping.ts')).toEqual([])
  })
})

/** The rule each import of an app made of these files breaks, cruised with the app's rules. */
async function violations(files: Readonly<Record<string, string>>) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'cruise-')))
  try {
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true })
      writeFileSync(join(root, path), text)
    }
    const { output } = await cruise(['src'], {
      baseDir: root,
      validate: true,
      ruleSet: { forbidden: depcruise.forbidden ?? [] },
      doNotFollow: depcruise.options?.doNotFollow ?? {},
      tsPreCompilationDeps: depcruise.options?.tsPreCompilationDeps ?? true,
    })
    if (typeof output === 'string') throw new Error(output)
    return output.summary.violations.map(({ rule, from, to }) => `${rule.name}: ${from} → ${to}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

describe('the tiers and sides of the design system', () => {
  // A small design system: a seam, a shared atom and layout, and a piece of each side. As written it breaks
  // no rule, each importing only below it; each case adds one import that must.
  const ui: Readonly<Record<string, string>> = {
    'src/front/ui/seams/markdown.ts': 'export const markdown = 1\n',
    'src/front/ui/atoms/button.ts':
      "import { markdown } from '../seams/markdown'\nexport const button = markdown\n",
    'src/front/ui/layouts/dialog.ts':
      "import { button } from '../atoms/button'\nexport const dialog = button\n",
    'src/front/ui/chat/composer.ts':
      "import { dialog } from '../layouts/dialog'\nexport const composer = dialog\n",
    'src/front/ui/canvas/atoms/tooltip.ts': 'export const tooltip = 1\n',
    'src/front/ui/canvas/tile.ts':
      "import { button } from '../atoms/button'\nimport { tooltip } from './atoms/tooltip'\nexport const tile = [button, tooltip]\n",
    'src/front/ui/crossings.ts':
      "import { composer } from './chat/composer'\nimport { tile } from './canvas/tile'\nexport const crossing = [composer, tile]\n",
  }
  const importing = (path: string) => `import * as above from '${path}'\nexport const a = above\n`

  it('lets a side import its own pieces and the shared ones, a layout an atom, an atom a seam, and the crossings both sides', async () => {
    expect(await violations(ui)).toEqual([])
  })

  it.each([
    [
      'the chat the canvas',
      'src/front/ui/chat/reach.ts',
      '../canvas/tile',
      'src/front/ui/canvas/tile.ts',
      'no-side-importing-the-other',
    ],
    [
      'the canvas the chat',
      'src/front/ui/canvas/atoms/reach.ts',
      '../../chat/composer',
      'src/front/ui/chat/composer.ts',
      'no-side-importing-the-other',
    ],
    [
      'a shared layout a side',
      'src/front/ui/layouts/reach.ts',
      '../chat/composer',
      'src/front/ui/chat/composer.ts',
      'no-layouts-importing-up',
    ],
    [
      'a shared atom a side',
      'src/front/ui/atoms/reach.ts',
      '../canvas/tile',
      'src/front/ui/canvas/tile.ts',
      'no-atoms-importing-up',
    ],
    [
      'a shared atom a layout',
      'src/front/ui/atoms/reach.ts',
      '../layouts/dialog',
      'src/front/ui/layouts/dialog.ts',
      'no-atoms-importing-up',
    ],
    [
      'a seam an atom',
      'src/front/ui/seams/reach.ts',
      '../atoms/button',
      'src/front/ui/atoms/button.ts',
      'no-seams-importing-up',
    ],
    [
      'another file at its root a side',
      'src/front/ui/reach.ts',
      './chat/composer',
      'src/front/ui/chat/composer.ts',
      'no-ui-root-joining-the-sides',
    ],
    [
      'a piece the crossings',
      'src/front/ui/layouts/reach.ts',
      '../crossings',
      'src/front/ui/crossings.ts',
      'no-ui-importing-the-crossings',
    ],
  ])('refuses %s', async (_, from, path, to, rule) => {
    expect(await violations({ ...ui, [from]: importing(path) })).toEqual([
      `${rule}: ${from} → ${to}`,
    ])
  })
})

describe('the door to a domain', () => {
  // A small app, written to a folder of its own and cruised with the app's rules: a domain `d` with its
  // door, its application service and a concept folder; another domain; a repository; and a route
  // that imports the door. As written it breaks no rule, and each case adds one import that must.
  const app: Readonly<Record<string, string>> = {
    'src/domains/kind.ts': 'export const kind = 1\n',
    'src/domains/bus.ts': 'export interface DomainEvent { readonly _tag: string }\n',
    'src/domains/d/errors.ts': "import { kind } from '../kind'\nexport const refusal = kind\n",
    'src/domains/d/entities/index.ts': "export * from './tile'\n",
    'src/domains/d/entities/tile.ts':
      "import { Schema } from 'effect'\nimport { refusal } from '../errors'\nexport const Tile = Schema.String\nexport const refused = refusal\n",
    'src/domains/d/operations/index.ts':
      "import type { DomainEvent } from '../../bus'\nimport { Tile } from '../entities'\nexport type Event = DomainEvent\nexport const Operation = Tile\n",
    'src/domains/d/d.ts': "import { Tile } from './entities'\nexport const service = Tile\n",
    'src/domains/d/concept/concept.ts': 'export const concept = 1\n',
    'src/domains/e/entities/index.ts': 'export const other = 1\n',
    'src/repositories/r/r.ts': 'export interface RowOf { readonly id: string }\n',
    'src/front/routes/page.ts':
      "import { refusal } from '../../domains/d/errors'\nimport { Tile } from '../../domains/d/entities'\nimport { Operation } from '../../domains/d/operations'\nexport const page = [refusal, Tile, Operation]\n",
  }

  /** The rule each import an app with these files added breaks, and what it imports. */
  const broken = (added: Readonly<Record<string, string>>) => violations({ ...app, ...added })

  const tile = 'src/domains/d/entities/tile.ts'
  const reaching = 'no-door-reaching-past-the-pure-model'

  it("refuses a program importing a domain's testing.ts, and lets a test and another testing.ts", async () => {
    const testing = { 'src/domains/d/testing.ts': 'export const harness = 1\n' }
    const importing = "import { harness } from './testing'\nexport const used = harness\n"
    expect(await broken({ ...testing, 'src/domains/d/program.ts': importing })).toEqual([
      'no-program-importing-a-domains-testing: src/domains/d/program.ts → src/domains/d/testing.ts',
    ])
    expect(
      await broken({
        ...testing,
        'src/domains/d/d.test.ts': importing,
        'src/domains/d/concept/testing.ts':
          "import { harness } from '../testing'\nexport const shared = harness\n",
      }),
    ).toEqual([])
  })

  it('lets the front import the door, and the door reach its pure model, effect, the kinds and the bus', async () => {
    expect(await broken({})).toEqual([])
  })

  it.each([
    ['the application service', '../../domains/d/d', 'src/domains/d/d.ts'],
    ['a concept folder', '../../domains/d/concept/concept', 'src/domains/d/concept/concept.ts'],
    ['an entity past the index', '../../domains/d/entities/tile', tile],
    ['a repository', '../../repositories/r/r', 'src/repositories/r/r.ts'],
    ['the kinds', '../../domains/kind', 'src/domains/kind.ts'],
  ])('refuses the front %s', async (_, from, to) => {
    const page = `import * as past from '${from}'\nexport const reached = past\n`
    expect(await broken({ 'src/front/routes/past.ts': page })).toEqual([
      `no-front-past-a-domains-door: src/front/routes/past.ts → ${to}`,
    ])
  })

  it.each([
    [
      'a repository, by a type-only import',
      "import type { RowOf } from '../../../repositories/r/r'\nexport type Row = RowOf\n",
      'src/repositories/r/r.ts',
    ],
    [
      'the application service',
      "import { service } from '../d'\nexport const s = service\n",
      'src/domains/d/d.ts',
    ],
    [
      'a concept folder',
      "import { concept } from '../concept/concept'\nexport const c = concept\n",
      'src/domains/d/concept/concept.ts',
    ],
    [
      'another domain',
      "import { other } from '../../e/entities'\nexport const o = other\n",
      'src/domains/e/entities/index.ts',
    ],
    ['Node', "import { readFileSync } from 'node:fs'\nexport const read = readFileSync\n", 'fs'],
  ])('refuses the door reaching %s, a file away', async (_, imports, to) => {
    const reach = 'src/domains/d/entities/reach.ts'
    const added = {
      [reach]: imports,
      'src/domains/d/entities/index.ts': "export * from './tile'\nexport * from './reach'\n",
    }
    // operations/index.ts imports the entities, so it reaches the same module through them; another
    // domain breaks `no-domain-importing-another` as well, which is not this rule's to prove.
    const found = (await broken(added)).filter((violation) => violation.startsWith(reaching))
    expect(found).toEqual([
      `${reaching}: src/domains/d/entities/index.ts → ${to}`,
      `${reaching}: src/domains/d/operations/index.ts → ${to}`,
    ])
  })

  it('holds errors.ts and operations/index.ts as it holds the entities', async () => {
    const added = {
      'src/domains/d/errors.ts':
        "import { kind } from '../kind'\nimport { service } from './d'\nexport const refusal = [kind, service]\n",
      'src/domains/d/operations/index.ts':
        "import type { RowOf } from '../../../repositories/r/r'\nexport type Operation = RowOf\n",
    }
    const found = await broken(added)
    expect(found).toContain(`${reaching}: src/domains/d/errors.ts → src/domains/d/d.ts`)
    expect(found).toContain(
      `${reaching}: src/domains/d/operations/index.ts → src/repositories/r/r.ts`,
    )
  })
})
