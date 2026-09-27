import comments from '@eslint-community/eslint-plugin-eslint-comments/configs'
import js from '@eslint/js'
import sonarjs from 'eslint-plugin-sonarjs'
import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'

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
)
