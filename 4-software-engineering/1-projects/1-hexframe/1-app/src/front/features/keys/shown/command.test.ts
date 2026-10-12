import { describe, expect, it } from 'vitest'

import { mcpCommand } from './command'

describe('mcpCommand', () => {
  it("adds the page's own /mcp to Claude Code, the Key as a Bearer header", () => {
    expect(mcpCommand('https://hexframe.example', 'hf_secret')).toBe(
      'claude mcp add --transport http hexframe https://hexframe.example/mcp --header "Authorization: Bearer hf_secret"',
    )
  })

  it('keeps the port of a local origin, and adds no second slash', () => {
    expect(mcpCommand('http://localhost:5173', 'hf_x')).toContain(' http://localhost:5173/mcp ')
    expect(mcpCommand('http://localhost:5173/', 'hf_x')).toContain(' http://localhost:5173/mcp ')
  })
})
