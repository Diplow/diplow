import comments from '@eslint-community/eslint-plugin-eslint-comments/configs'
import js from '@eslint/js'
import sonarjs from 'eslint-plugin-sonarjs'
import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'

// Colour comes from theme tokens (src/styles.css), never a hex nor a Tailwind palette name such as
// `bg-zinc-900` or `text-white`: a literal would miss the other theme. Esquery regexes cannot hold a `/`.
// `#rgb`, `#rrggbb`, `#rrggbbaa`; `#rgba` is left out, since it reads like an anchor (`#cafe`) or an issue (`#1234`).
const hex = '#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\\b'
// A palette name with its shade after any utility (`bg-zinc-900`, `border-x-red-500/50`), or black and white.
const palette = [
  '-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|[1-9]00|950)\\b',
  '\\b(?:bg|text|border(?:-[xytblrse])?|ring(?:-offset)?|outline|fill|stroke|from|via|to|shadow|decoration|divide|accent|caret|placeholder)-(?:black|white)\\b',
].join('|')
const colourLiterals = [hex, palette].flatMap((pattern) =>
  ['Literal[value', 'TemplateElement[value.raw'].map((node) => ({
    selector: `${node}=/${pattern}/]`,
    message: 'Colour comes from a theme token (src/styles.css), never a hex or a palette name.',
  })),
)

// Only ui/ renders a table or a dialog, so each looks and behaves one way.
const rawElements = ['table', 'dialog'].map((element) => ({
  selector: `JSXOpeningElement[name.name='${element}']`,
  message: `No raw <${element}> outside src/ui/: build from the design system's component.`,
}))

// No effect hook outside ui/ (STACK.md, State): every piece of state has an owner, and syncing one
// into another is the bug the owners exist to prevent. Imported by name or read off `React`.
const effectHook = '/^use(?:Layout|Insertion)?Effect$/'
const effectHooks = [
  `ImportSpecifier[imported.name=${effectHook}]`,
  `MemberExpression[property.name=${effectHook}]`,
].map((selector) => ({
  selector,
  message: 'No useEffect outside src/ui/: give the state its owner (STACK.md, State).',
}))

// Effect stops at the server function (src/api/CLAUDE.md): its helper is the one place a program runs,
// so every server function gets the request's services and has its failures encoded the same way.
const effectRun = '/^run(?:Sync|Promise|Fork|Callback)/'
const helper = 'src/api/server/run.ts'
// Read off a module or a runtime (`Effect.runPromise`, `runtime['runSync']`), imported by name, or
// destructured (`const { runFork } = Effect`).
const effectRuns = [
  `MemberExpression[property.name=${effectRun}]`,
  `MemberExpression[property.value=${effectRun}]`,
  `ImportSpecifier[imported.name=${effectRun}]`,
  `ObjectPattern > Property[key.name=${effectRun}]`,
].map((selector) => ({
  selector,
  message: `Only the server function helper (${helper}) runs an Effect program.`,
}))

// A `.ts` in an import path is for what Node runs without a bundler: `scripts/migrate.ts` and the one
// file of the app it reaches through a relative import. Everywhere else in src/ the bundler resolves.
const migrationsFile = 'src/repositories/database/migrations.ts'
// The lint set from STACK.md. A rule may be disabled on the spot, but only with a `-- reason` that says why.
export default defineConfig(
  globalIgnores(['src/paraglide/', 'src/routeTree.gen.ts', '.output/', '.nitro/', '.tanstack/']),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  comments.recommended,
  {
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { sonarjs },
    rules: {
      '@eslint-community/eslint-comments/require-description': 'error',
      'sonarjs/cognitive-complexity': ['error', 15],
      'max-lines-per-function': ['error', { max: 150, skipBlankLines: true, skipComments: true }],
      'max-params': ['error', 5],
      'max-lines': ['error', { max: 600, skipBlankLines: true, skipComments: true }],
    },
  },
  // The app's code, where colour is rendered; scripts/lint.test.ts holds the literals these rules refuse.
  {
    files: ['src/**'],
    rules: { 'no-restricted-syntax': ['error', ...colourLiterals, ...effectRuns] },
  },
  {
    files: ['src/**'],
    ignores: ['src/ui/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...colourLiterals,
        ...rawElements,
        ...effectHooks,
        ...effectRuns,
      ],
    },
  },
  {
    files: ['src/**'],
    ignores: [migrationsFile],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '\\.tsx?$',
              message: `No .ts or .tsx in an import path under src/: the bundler resolves it. Only ${migrationsFile}, which Node runs as it is, needs one.`,
            },
          ],
        },
      ],
    },
  },
  {
    files: [helper],
    rules: { 'no-restricted-syntax': ['error', ...colourLiterals, ...rawElements, ...effectHooks] },
  },
)
