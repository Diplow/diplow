import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

// The chat names the one who acts in it "the agent", as Assistant's language does
// (`hexframe-app-design-system-v1/decisions.md#DEC-34`): no message says "the assistant", in either
// language. "Assistant", capitalized, is the domain's name, which a note may still say.

const messages = (language: string) =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL(`../../../../messages/${language}.json`, import.meta.url)), {
      encoding: 'utf8',
    }),
  ) as Record<string, string>

describe('the chat’s words', () => {
  it.each(['en', 'fr'])('name the agent, never "the assistant", in %s', (language) => {
    const naming = Object.entries(messages(language)).filter(([, value]) =>
      /\bassistant\b/u.test(value),
    )
    expect(naming).toEqual([])
  })
})
