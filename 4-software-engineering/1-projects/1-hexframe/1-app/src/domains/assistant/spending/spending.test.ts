import { Result } from 'effect'
import { describe, expect, it } from 'vitest'

import { settings } from '../settings'
import { allowedCall } from './call'
import { charged, limitReached, monthOf, mustWait, reserved } from './limits'

// What a Turn's agent may call, what a call costs, and when a Turn may spend no more: pure, on calls
// shaped as Claude Code sends them and usage as Anthropic reports it.

/** A call as Claude Code sends one, `extra` laid over it. */
const callOf = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    model: 'claude-sonnet-5-5',
    max_tokens: 8192,
    stream: true,
    metadata: { user_id: 'turn' },
    system: [{ type: 'text', text: 'You are Claude Code.', cache_control: { type: 'ephemeral' } }],
    tools: [
      {
        name: 'Read',
        description: 'Reads a file.',
        input_schema: { type: 'object', properties: { file_path: { type: 'string' } } },
      },
    ],
    thinking: { type: 'adaptive' },
    messages: [
      { role: 'user', content: 'Name my vault.' },
      {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: '', signature: 'sig' },
          { type: 'tool_use', id: 'toolu_1', name: 'Read', input: { file_path: 'CLAUDE.md' } },
        ],
      },
      {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: '# Ada' }],
      },
    ],
    ...extra,
  })

/** A call's body and headers as the proxy reads them, Claude Code's version by default. */
const asked = (body: string, betas?: string, version = '2023-06-01') =>
  allowedCall({ body, betas, version })

const refusal = (text: string, betas?: string, version?: string) => {
  const allowed = asked(text, betas, version)
  return Result.isFailure(allowed) ? allowed.failure : undefined
}

describe('a model call the proxy lets through', () => {
  it('takes a call of a model the settings name, with client tools and the betas they name', () => {
    const allowed = asked(callOf(), 'claude-code-20250219, interleaved-thinking-2025-05-14')
    expect(Result.isSuccess(allowed) && allowed.success.model).toBe('claude-sonnet-5-5')
    expect(Result.isSuccess(asked(callOf({ model: 'claude-haiku-4-5' })))).toBe(true)
  })

  it('sends a call asking for more tokens than the cap asking for the cap, and a smaller one as it is', () => {
    const capped = asked(callOf({ max_tokens: 128_000 }))
    expect(Result.isSuccess(capped) && capped.success.body.max_tokens).toBe(
      settings.model.maxTokens,
    )
    const small = asked(callOf({ max_tokens: 100 }))
    expect(Result.isSuccess(small) && small.success.body.max_tokens).toBe(100)
  })

  it('keeps a thinking budget below the cap, which must stay below `max_tokens`', () => {
    const thinking = { type: 'enabled', budget_tokens: 60_000 }
    const capped = asked(callOf({ model: 'claude-haiku-4-5', max_tokens: 64_000, thinking }))
    expect(Result.isSuccess(capped) && capped.success.body.thinking).toEqual({
      type: 'enabled',
      budget_tokens: settings.model.maxTokens - 1,
    })
    const within = asked(callOf({ thinking: { type: 'enabled', budget_tokens: 2048 } }))
    expect(Result.isSuccess(within) && within.success.body.thinking?.budget_tokens).toBe(2048)
  })

  it('takes a count of tokens, which asks for none', () => {
    const counted = JSON.stringify({
      model: 'claude-haiku-4-5',
      messages: [{ role: 'user', content: 'hi' }],
    })
    expect(Result.isSuccess(asked(counted))).toBe(true)
  })

  it('refuses a model the settings do not name', () => {
    expect(refusal(callOf({ model: 'claude-opus-5-5' }))).toMatchObject({ why: 'invalid' })
  })

  it('refuses a field the settings do not name, at the top or deeper', () => {
    const mcp = { mcp_servers: [{ type: 'url', url: 'https://evil.test', name: 'x' }] }
    expect(refusal(callOf(mcp))).toMatchObject({ why: 'invalid' })
    expect(refusal(callOf({ fallbacks: 'default' }))).toMatchObject({ why: 'invalid' })
    expect(refusal(callOf({ speed: 'fast' }))).toMatchObject({ why: 'invalid' })
    expect(refusal(callOf({ thinking: { type: 'adaptive', other: 1 } }))).toMatchObject({
      why: 'invalid',
    })
  })

  it('takes each object Anthropic gives a shape in that shape: a tool’s, its cache, the answer’s, the context’s', () => {
    const tool = {
      name: 'Read',
      input_schema: { type: 'object', properties: {}, additionalProperties: false },
      cache_control: { type: 'ephemeral', ttl: '1h' },
    }
    const shaped = callOf({
      tools: [tool],
      output_config: {
        effort: 'high',
        format: { type: 'json_schema', schema: { type: 'object', properties: {} } },
        task_budget: { type: 'tokens', total: 64_000, remaining: 20_000 },
      },
      context_management: {
        edits: [
          { type: 'clear_tool_uses_20250919', trigger: { type: 'input_tokens', value: 100_000 } },
          { type: 'clear_thinking_20251015', keep: 'all' },
        ],
      },
    })
    expect(Result.isSuccess(asked(shaped))).toBe(true)
  })

  it('refuses an object out of its shape: a message, a tool’s schema or cache, the answer’s, the context’s', () => {
    const tool = (extra: Record<string, unknown>) => ({
      tools: [{ name: 'Read', input_schema: { type: 'object' }, ...extra }],
    })
    const outOfShape = [
      { messages: [{ role: 'user', content: 'hi', speed: 'fast' }] },
      tool({ input_schema: { type: 'string' } }),
      tool({ cache_control: { type: 'persistent' } }),
      tool({ cache_control: { type: 'ephemeral', other: 1 } }),
      { output_config: { format: { type: 'text' } } },
      { output_config: { task_budget: { type: 'dollars', total: 1 } } },
      { context_management: { edits: [{ type: 'compact_20260112' }] } },
      { context_management: { edits: [], other: 1 } },
    ]
    for (const extra of outOfShape) {
      expect(refusal(callOf(extra))).toMatchObject({ why: 'invalid' })
    }
  })

  it('refuses a server tool, and its use or its result in a message', () => {
    const webFetch = { type: 'web_fetch_20260209', name: 'web_fetch' }
    expect(refusal(callOf({ tools: [webFetch] }))).toMatchObject({ why: 'invalid' })
    const codeExecution = { type: 'code_execution_20260521', name: 'code_execution' }
    expect(refusal(callOf({ tools: [codeExecution] }))).toMatchObject({ why: 'invalid' })
    const serverUse = {
      role: 'assistant',
      content: [{ type: 'server_tool_use', id: 's', name: 'web_fetch', input: {} }],
    }
    expect(refusal(callOf({ messages: [serverUse] }))).toMatchObject({ why: 'invalid' })
  })

  it('takes an image or a document held inline, in a message or a tool’s result', () => {
    const image = {
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: 'iVBO' },
    }
    const pdf = {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: 'JVBE' },
    }
    const text = {
      type: 'document',
      source: { type: 'text', media_type: 'text/plain', data: 'Ada' },
    }
    const said = { role: 'user', content: [image, pdf, text] }
    expect(Result.isSuccess(asked(callOf({ messages: [said] })))).toBe(true)
    const result = { type: 'tool_result', tool_use_id: 'toolu_1', content: [image, pdf] }
    const read = { role: 'user', content: [result] }
    expect(Result.isSuccess(asked(callOf({ messages: [read] })))).toBe(true)
  })

  it('refuses an image or a document Anthropic would fetch, at a URL or among the stored files', () => {
    const url = { type: 'url', url: 'https://evil.test/huge.pdf' }
    const file = { type: 'file', file_id: 'file_1' }
    for (const block of [
      { type: 'image', source: url },
      { type: 'document', source: url },
      { type: 'image', source: file },
      { type: 'document', source: file },
      { type: 'image' },
    ]) {
      const said = { role: 'user', content: [block] }
      expect(refusal(callOf({ messages: [said] }))).toMatchObject({ why: 'invalid' })
      const result = { type: 'tool_result', tool_use_id: 'toolu_1', content: [block] }
      const read = { role: 'user', content: [result] }
      expect(refusal(callOf({ messages: [read] }))).toMatchObject({ why: 'invalid' })
    }
  })

  it('refuses a beta the settings do not name, saying which', () => {
    expect(refusal(callOf(), 'claude-code-20250219,mcp-client-2025-11-20')).toEqual({
      why: 'invalid',
      message: 'Unnamed betas: mcp-client-2025-11-20',
    })
  })

  it('refuses an `anthropic-version` that is no date', () => {
    expect(refusal(callOf(), undefined, '2023-06-01\r\nx-api-key: stolen')).toMatchObject({
      why: 'invalid',
    })
  })

  it('refuses a body that is no JSON', () => {
    expect(refusal('{"model":')).toMatchObject({ why: 'invalid' })
  })
})

describe('what a call costs', () => {
  const used = {
    input: 1000,
    output: 500,
    cacheWrite5m: 2000,
    cacheWrite1h: 100,
    cacheRead: 10_000,
    complete: true,
  }

  it('prices each kind of token at its model’s price, in millionths of a dollar, rounded up', () => {
    // Sonnet 5.5: 1000×2 + 500×10 + 2000×2.5 + 100×4 + 10000×0.2
    expect(charged('claude-sonnet-5-5', 8192, used)).toBe(14_400)
    // Haiku 4.5: 1000×1 + 500×5 + 2000×1.25 + 100×2 + 10000×0.1
    expect(charged('claude-haiku-4-5', 8192, used)).toBe(7200)
    const read = { ...used, input: 0, output: 0, cacheWrite5m: 0, cacheWrite1h: 0, cacheRead: 3 }
    expect(charged('claude-sonnet-5-5', 8192, read)).toBe(1)
  })

  it('charges an answer cut short the output it may have answered', () => {
    const cut = { ...used, complete: false }
    // Sonnet 5.5: the 500 output tokens seen become the 8192 it may have answered.
    expect(charged('claude-sonnet-5-5', 8192, cut)).toBe(14_400 + (8192 - 500) * 10)
    expect(charged('claude-sonnet-5-5', 100, cut)).toBe(14_400)
  })

  it('charges nothing for an answer Anthropic refused', () => {
    expect(charged('claude-sonnet-5-5', 8192, undefined)).toBe(0)
  })

  it('reserves, before a call goes, its body as input at the dearest input price, and its output', () => {
    // Sonnet 5.5: 32,000 output tokens at $10, 1,000 characters at $4, an hour's cache write.
    expect(reserved('claude-sonnet-5-5', { maxTokens: 32_000, length: 1000 })).toBe(324_000)
    expect(reserved('claude-haiku-4-5', { maxTokens: 0, length: 0 })).toBe(0)
  })
})

describe('whether a Turn may spend', () => {
  const { ceiling } = settings.turn
  const { allowance } = settings.month

  it('lets a Turn spend until its own ceiling, then holds it back', () => {
    expect(limitReached({ turn: ceiling - 1, month: ceiling - 1 })).toBeUndefined()
    expect(limitReached({ turn: ceiling, month: ceiling })).toBe('ceiling')
  })

  it("lets an Account's Turns spend until the month's allowance, then holds them back", () => {
    expect(limitReached({ turn: 0, month: allowance - 1 })).toBeUndefined()
    expect(limitReached({ turn: 0, month: allowance })).toBe('allowance')
  })

  it('names the ceiling first when a Turn reached both', () => {
    expect(limitReached({ turn: ceiling, month: allowance })).toBe('ceiling')
  })

  it('lets a call go with none under way, whatever it reserves, and makes it wait when the ones under way leave too little', () => {
    const idle = { turn: { spent: 0, reserved: 0 }, month: { spent: 0, reserved: 0 } }
    expect(mustWait(idle, ceiling * 2)).toBe(false)
    const busy = { turn: { spent: 0, reserved: 600_000 }, month: { spent: 0, reserved: 600_000 } }
    expect(mustWait(busy, ceiling - 600_000)).toBe(false)
    expect(mustWait(busy, ceiling - 600_000 + 1)).toBe(true)
    const monthly = {
      turn: { spent: 0, reserved: 1 },
      month: { spent: allowance - 10, reserved: 1 },
    }
    expect(mustWait(monthly, 9)).toBe(false)
    expect(mustWait(monthly, 10)).toBe(true)
  })

  it('counts a month from its first instant, UTC', () => {
    expect(monthOf(new Date('2026-10-10T13:35:57Z'))).toEqual(new Date('2026-10-01T00:00:00Z'))
    expect(monthOf(new Date('2026-10-01T00:00:00Z'))).toEqual(new Date('2026-10-01T00:00:00Z'))
    expect(monthOf(new Date('2026-09-30T23:59:59.999Z'))).toEqual(new Date('2026-09-01T00:00:00Z'))
  })
})
