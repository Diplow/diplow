// The lint rules that keep features on the design system, proved to fire: a regex that silently
// stops matching would leave `pnpm check` green while the rule it carries is gone.
import { join } from 'node:path'

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

const feature = 'src/routes/index.tsx'
const inUi = 'src/ui/data/DataTable.tsx'
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

  it.each(['bg-background text-muted-foreground whitespace-nowrap', '#cafe', '#/ui/tokens'])(
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

describe('the raw element lint', () => {
  it.each(['table', 'dialog'])('refuses a <%s> outside ui/', async (element) => {
    const messages = await restrictedSyntax(`export const e = <${element} />\n`, feature)
    expect(messages).toEqual([
      `No raw <${element}> outside src/ui/: build from the design system's component.`,
    ])
  })

  it.each(['table', 'dialog'])('lets ui/ render a <%s>', async (element) => {
    expect(await restrictedSyntax(`export const e = <${element} />\n`, inUi)).toEqual([])
  })
})

describe('the effect hook lint', () => {
  const effect = /No useEffect outside src\/ui\//

  it.each([
    "import { useEffect } from 'react'\nuseEffect(() => undefined)\n",
    "import { useLayoutEffect as run } from 'react'\nrun(() => undefined)\n",
    "import * as React from 'react'\nReact.useEffect(() => undefined)\n",
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
  ]
  const files = [feature, inUi, 'src/api/dev/provoke.ts']

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

  it('exempts src/ui/ and nothing else', () => {
    expect(exempt.test('src/ui/overlays/Drawer.tsx')).toBe(true)
    expect(exempt.test('src/routes/index.tsx')).toBe(false)
  })
})
