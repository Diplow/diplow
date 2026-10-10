import { Redacted } from 'effect'
import { describe, expect, it } from 'vitest'

import type { Entry } from '../entities'
import { settings } from '../settings'
import { launchOf, processOf, withoutTools } from './launch'
import { promptOf } from './prompt'
import { readLine } from './stream'

// How a Turn runs, pure: what Assistant keeps of the agent's stream, recorded as Claude Code writes it
// with `-p --output-format stream-json --verbose`; the prompt it is told; and the files and the
// process a Turn starts in its sandbox, the Turn's Key in the process's environment alone.

/** Lines of a Turn as Claude Code writes them, trimmed to what matters, every field it adds kept. */
const recorded = {
  init: JSON.stringify({
    type: 'system',
    subtype: 'init',
    cwd: '/blaxel/hexframe/system/3-games',
    session_id: 'b1f0',
    tools: ['Bash', 'Read', 'mcp__hexframe__open_tile'],
    model: 'claude-sonnet-5-5',
  }),
  text: JSON.stringify({
    type: 'assistant',
    message: {
      id: 'msg_01',
      role: 'assistant',
      model: 'claude-sonnet-5-5',
      content: [{ type: 'text', text: '  Let me look at Games first.\n' }],
      usage: { input_tokens: 10, output_tokens: 8 },
    },
    session_id: 'b1f0',
  }),
  read: JSON.stringify({
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [
        { type: 'thinking', thinking: 'The folder holds it.' },
        { type: 'tool_use', id: 'toolu_1', name: 'Read', input: { file_path: 'CLAUDE.md' } },
      ],
    },
  }),
  shell: JSON.stringify({
    type: 'assistant',
    message: {
      content: [
        { type: 'text', text: 'Listing the folder.' },
        {
          type: 'tool_use',
          id: 'toolu_2',
          name: 'Bash',
          input: { command: 'ls -la\n  ..', description: 'List the folder' },
        },
      ],
    },
  }),
  write: JSON.stringify({
    type: 'assistant',
    message: {
      content: [
        {
          type: 'tool_use',
          id: 'toolu_3',
          name: 'mcp__hexframe__edit_tile',
          input: { id: 'games', version: 2, title: 'Games' },
        },
      ],
    },
  }),
  toolResult: JSON.stringify({
    type: 'user',
    message: {
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'x' }],
    },
  }),
  result: (subtype: string) =>
    JSON.stringify({
      type: 'result',
      subtype,
      is_error: subtype !== 'success',
      result: 'I renamed Games.',
      total_cost_usd: 0.12,
      num_turns: 4,
      session_id: 'b1f0',
    }),
  exit: JSON.stringify({ type: 'hexframe_exit', code: 1, signal: null }),
}

describe("what Assistant keeps of the agent's stream", () => {
  it('keeps the text the agent says, and the tool it runs now, by its subject', () => {
    expect(readLine(recorded.text)).toEqual([{ _tag: 'Said', text: 'Let me look at Games first.' }])
    expect(readLine(recorded.read)).toEqual([
      { _tag: 'Stepping', step: { tool: 'Read', detail: 'CLAUDE.md' } },
    ])
    expect(readLine(recorded.shell)).toEqual([
      { _tag: 'Said', text: 'Listing the folder.' },
      { _tag: 'Stepping', step: { tool: 'Bash', detail: 'ls -la ..' } },
    ])
  })

  it('names an MCP tool without its server, and says what it works on', () => {
    expect(readLine(recorded.write)).toEqual([
      { _tag: 'Stepping', step: { tool: 'edit_tile', detail: 'games' } },
    ])
  })

  it('cuts a step short, never a file’s content', () => {
    const long = JSON.stringify({
      type: 'assistant',
      message: {
        content: [{ type: 'tool_use', name: 'Bash', input: { command: 'x'.repeat(1_000) } }],
      },
    })
    expect(readLine(long)).toEqual([
      { _tag: 'Stepping', step: { tool: 'Bash', detail: 'x'.repeat(200) } },
    ])
  })

  it('ends the Turn by its result: its answer, its ceiling, or its sandbox', () => {
    expect(readLine(recorded.result('success'))).toEqual([{ _tag: 'Finished', how: 'answered' }])
    expect(readLine(recorded.result('error_max_budget_usd'))).toEqual([
      { _tag: 'Finished', how: 'ceiling' },
    ])
    const failed = JSON.stringify({ type: 'result', subtype: 'success', is_error: true })
    expect(readLine(failed)).toEqual([{ _tag: 'Finished', how: 'sandbox' }])
    for (const subtype of ['error_during_execution', 'error_max_turns']) {
      expect(readLine(recorded.result(subtype))).toEqual([{ _tag: 'Finished', how: 'sandbox' }])
    }
  })

  it('hears the launcher say the agent exited', () => {
    expect(readLine(recorded.exit)).toEqual([{ _tag: 'Exited' }])
  })

  it('leaves out every other event, and the tool results', () => {
    expect(readLine(recorded.init)).toEqual([])
    expect(readLine(recorded.toolResult)).toEqual([])
    expect(readLine(JSON.stringify({ type: 'stream_event', event: {} }))).toEqual([])
  })

  it('never keeps a Turn’s Key the agent says, in its text or its step', () => {
    const secret = 'hft_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG'
    const said = JSON.stringify({
      type: 'assistant',
      message: {
        content: [
          { type: 'text', text: `My key is ${secret}.` },
          { type: 'tool_use', name: 'Bash', input: { command: `echo ${secret}` } },
        ],
      },
    })
    expect(readLine(said)).toEqual([
      { _tag: 'Said', text: 'My key is hft_….' },
      { _tag: 'Stepping', step: { tool: 'Bash', detail: 'echo hft_…' } },
    ])
  })

  it('reads no event in a line that is no JSON or names no type', () => {
    for (const line of [
      '',
      'not json',
      '{"type": 1}',
      '[]',
      '{"message": {}}',
      recorded.text.slice(0, 40),
    ]) {
      expect(readLine(line), line).toBeUndefined()
    }
  })
})

describe("a Turn's prompt", () => {
  const at = new Date('2026-10-10T14:02:00Z')
  const entries: ReadonlyArray<Entry> = [
    { _tag: 'Message', author: 'user', text: 'Rename Games.', id: 'e1', at },
    {
      _tag: 'Navigation',
      steps: [{ gesture: 'center', tile: 'games' }],
      gestures: 3,
      id: 'e2',
      at,
    },
    {
      _tag: 'Change',
      verb: 'TileEdited',
      tile: { id: 'games', title: 'Play' },
      actor: { _tag: 'Key', name: 'Claude Code' },
      id: 'e3',
      at,
    },
    { _tag: 'TurnEnded', how: 'stopped', id: 'e4', at },
    { _tag: 'Message', author: 'agent', text: 'Done.', id: 'e5', at },
  ]
  const prompt = promptOf({
    entries,
    titles: { games: 'Games' },
    onScreen: [
      { id: 'games', title: 'Games', preview: 'What I play.' },
      { id: 'chess', title: '', preview: '' },
    ],
    location: { id: 'games', title: 'Games', folder: '3-games' },
    help: 'help',
  })

  it('tells the agent its files are a snapshot, its changes go through the MCP, and where Help is', () => {
    expect(prompt).toContain('read-only snapshot')
    expect(prompt).toContain('naming the version of the Tile')
    expect(prompt).toContain('read it again with open_tile')
    expect(prompt).toContain('open_tile({ id: "help" })')
  })

  it('says where the Turn starts, and the Tiles on screen with their Previews', () => {
    expect(prompt).toContain('You start in "Games" (id games), `3-games`.')
    expect(prompt).toContain('- "Games" (id games): What I play.')
    expect(prompt).toContain('- an untitled Tile (id chess)')
  })

  it('lists today’s Entries, oldest first, each as the agent reads it', () => {
    const lines = prompt.split('\n').filter((line) => line.startsWith('- 14:02 UTC'))
    expect(lines).toEqual([
      '- 14:02 UTC: User: Rename Games.',
      '- 14:02 UTC: The user moved around the canvas (3 gestures), lastly: center "Games" (id games).',
      '- 14:02 UTC: The key "Claude Code" TileEdited "Play" (id games).',
      '- 14:02 UTC: A Turn of yours ended before its answer: the user stopped it.',
      '- 14:02 UTC: You: Done.',
    ])
  })
})

/** The app's doors, as the API layer names them. */
const doors = { mcp: '/mcp', model: '/assistant/anthropic', events: '/assistant/events' }

describe("a Turn's launch", () => {
  const secret = 'hft_the-turns-own-key'
  const launched = launchOf({
    turnId: 'turn-1',
    key: Redacted.make(secret),
    origin: 'https://hexframe.ai',
    doors,
    home: '/blaxel/hexframe',
    agent: ['claude'],
    folder: '3-games',
    message: 'Rename Games.',
    prompt: 'The prompt.',
  })
  const settingsOf = () => {
    const file = launched.files.find(({ path }) => path === 'turns/turn-1/turn.json')
    return JSON.parse(file?.content ?? '{}') as { args: string[]; mcp: string; events: string }
  }

  it('writes its prompt, its settings and its launcher beside the System folder, no secret in them', () => {
    expect(launched.files.map(({ path }) => path)).toEqual([
      'turns/turn-1/prompt.md',
      'turns/turn-1/turn.json',
      'turns/turn-1/launcher.mjs',
    ])
    for (const { content } of launched.files) expect(content).not.toContain(secret)
  })

  it('starts the launcher detached in the Tile’s folder, for the Turn’s maximum length', () => {
    expect(launched.run).toMatchObject({
      name: processOf('turn-1'),
      command: "exec node '/blaxel/hexframe/turns/turn-1/launcher.mjs'",
      workingDir: 'system/3-games',
      timeoutSeconds: settings.turn.longest / 1000,
    })
  })

  it('puts the Turn’s Key in the process’s environment, beside the model’s settings', () => {
    expect(launched.run.env).toEqual({
      HOME: '/blaxel/hexframe/work/turn-turn-1',
      HEXFRAME_TURN_KEY: secret,
      ANTHROPIC_AUTH_TOKEN: secret,
      ANTHROPIC_BASE_URL: 'https://hexframe.ai/assistant/anthropic',
      ANTHROPIC_MODEL: settings.turn.model,
      ANTHROPIC_DEFAULT_HAIKU_MODEL: settings.turn.smallModel,
      ANTHROPIC_SMALL_FAST_MODEL: settings.turn.smallModel,
      CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: '1',
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    })
  })

  it('runs Claude Code in print mode, streaming, on the settings’ model, without writing tools or the web', () => {
    const { args, mcp, events } = settingsOf()
    expect(args.slice(0, 4)).toEqual(['-p', '--output-format', 'stream-json', '--verbose'])
    expect(args).toContain('--strict-mcp-config')
    const disallowed = args.indexOf('--disallowedTools')
    expect(args.slice(disallowed + 1, disallowed + 1 + withoutTools.length)).toEqual([
      ...withoutTools,
    ])
    expect(args[args.indexOf('--model') + 1]).toBe(settings.turn.model)
    expect(args[args.indexOf('--max-budget-usd') + 1]).toBe('1')
    expect(args[args.indexOf('--append-system-prompt-file') + 1]).toBe(
      '/blaxel/hexframe/turns/turn-1/prompt.md',
    )
    expect(mcp).toBe('https://hexframe.ai/mcp')
    expect(events).toBe('https://hexframe.ai/assistant/events')
  })

  it('starts at the System folder itself for the Root', () => {
    expect(launchOf({ ...launchArgs(), folder: '' }).run.workingDir).toBe('system')
  })
})

/** A launch's arguments, for a test that changes one. */
const launchArgs = () => ({
  turnId: 't',
  key: Redacted.make('hft_k'),
  origin: 'http://localhost:5173',
  doors,
  home: '/tmp/box',
  agent: ['node', 'fake.mjs'],
  folder: '',
  message: 'Hi',
  prompt: '',
})
