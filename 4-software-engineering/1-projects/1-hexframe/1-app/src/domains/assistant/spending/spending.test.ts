import { Result } from 'effect'
import { describe, expect, it } from 'vitest'

import { settings } from '../settings'
import { allowedCall } from './call'
import { limitReached, monthOf, priced } from './limits'

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

const refusal = (text: string, betas?: string) => {
  const allowed = allowedCall(text, betas)
  return Result.isFailure(allowed) ? allowed.failure : undefined
}

describe('a model call the proxy lets through', () => {
  it('takes a call of a model the settings name, with client tools and the betas they name', () => {
    const allowed = allowedCall(callOf(), 'claude-code-20250219, interleaved-thinking-2025-05-14')
    expect(Result.isSuccess(allowed) && allowed.success.model).toBe('claude-sonnet-5-5')
    expect(Result.isSuccess(allowedCall(callOf({ model: 'claude-haiku-4-5' }), undefined))).toBe(
      true,
    )
  })

  it('sends a call asking for more tokens than the cap asking for the cap, and a smaller one as it is', () => {
    const capped = allowedCall(callOf({ max_tokens: 128_000 }), undefined)
    expect(Result.isSuccess(capped) && capped.success.body.max_tokens).toBe(
      settings.model.maxTokens,
    )
    const small = allowedCall(callOf({ max_tokens: 100 }), undefined)
    expect(Result.isSuccess(small) && small.success.body.max_tokens).toBe(100)
  })

  it('takes a count of tokens, which asks for none', () => {
    const counted = JSON.stringify({
      model: 'claude-haiku-4-5',
      messages: [{ role: 'user', content: 'hi' }],
    })
    expect(Result.isSuccess(allowedCall(counted, undefined))).toBe(true)
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

  it('refuses a beta the settings do not name, saying which', () => {
    expect(refusal(callOf(), 'claude-code-20250219,mcp-client-2025-11-20')).toEqual({
      why: 'invalid',
      message: 'Unnamed betas: mcp-client-2025-11-20',
    })
  })

  it('refuses a body that is no JSON, and one past the largest call', () => {
    expect(refusal('{"model":')).toMatchObject({ why: 'invalid' })
    const huge = callOf({ system: 'x'.repeat(settings.model.largestCall) })
    expect(refusal(huge)).toEqual({ why: 'too-large' })
  })
})

describe('what a call costs', () => {
  it('prices each kind of token at its model’s price, in millionths of a dollar, rounded up', () => {
    const used = {
      input: 1000,
      output: 500,
      cacheWrite5m: 2000,
      cacheWrite1h: 100,
      cacheRead: 10_000,
    }
    // Sonnet 5.5: 1000×2 + 500×10 + 2000×2.5 + 100×4 + 10000×0.2
    expect(priced('claude-sonnet-5-5', used)).toBe(14_400)
    // Haiku 4.5: 1000×1 + 500×5 + 2000×1.25 + 100×2 + 10000×0.1
    expect(priced('claude-haiku-4-5', used)).toBe(7200)
    expect(
      priced('claude-sonnet-5-5', {
        ...used,
        input: 0,
        output: 0,
        cacheWrite5m: 0,
        cacheWrite1h: 0,
        cacheRead: 3,
      }),
    ).toBe(1)
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

  it('counts a month from its first instant, UTC', () => {
    expect(monthOf(new Date('2026-10-10T13:35:57Z'))).toEqual(new Date('2026-10-01T00:00:00Z'))
    expect(monthOf(new Date('2026-10-01T00:00:00Z'))).toEqual(new Date('2026-10-01T00:00:00Z'))
    expect(monthOf(new Date('2026-09-30T23:59:59.999Z'))).toEqual(new Date('2026-09-01T00:00:00Z'))
  })
})
