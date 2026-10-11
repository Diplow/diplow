// How a Turn runs in its sandbox: the files written beside the System folder, a prompt, the Turn's
// settings and the launcher, and the process started detached in the Tile's folder. The launcher, a
// small Node script, runs the agent, Claude Code or the sandbox's fake, posts each line it writes to
// the app's events door as it comes, so the answer is saved with the tab closed, then a line of its
// own once the agent exited; the API layer names the doors. The Turn's Key enters the sandbox once,
// in the process's environment, which the launcher hands to the agent as its model credential and
// its MCP client's bearer: never in a file, never in the prompt. Pure.
import { Redacted } from 'effect'

import { type Run, type SandboxFile, systemFolder } from '#/repositories/agent/sandbox/sandbox'

import { settings } from '../settings'

/**
 * The tools a Turn's agent goes without: its files are read-only and its changes go through the MCP,
 * so no writing tool; and no web.
 */
export const withoutTools = ['Write', 'Edit', 'NotebookEdit', 'WebFetch', 'WebSearch'] as const

/** The process a Turn runs as, by its id: what a Stop stops. */
export const processOf = (turnId: string) => `turn-${turnId}`

/** The folder of the sandbox's home a Turn's files are written in, by its id. */
const filesOf = (turnId: string) => `turns/${turnId}`

/**
 * The launcher: runs the agent the Turn's settings name, with their arguments, its MCP client's config,
 * whose bearer names the Turn's Key in its environment for the agent to expand, so the Key is on no
 * command line, and the Message last, after `--`; hands a SIGINT
 * or a SIGTERM on to it, so a Stop ends its turn cleanly; posts each line it writes to the events door,
 * one after another, with the Turn's Key as its bearer; then, once it exited, `hexframe_exit`.
 */
const launcher = String.raw`
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createInterface } from 'node:readline'

const turn = JSON.parse(readFileSync(new URL('./turn.json', import.meta.url), 'utf8'))
const key = process.env.HEXFRAME_TURN_KEY ?? ''
// The agent expands the Key from its environment itself: it is on no command line.
const mcp = JSON.stringify({
  mcpServers: {
    hexframe: {
      type: 'http',
      url: turn.mcp,
      headers: { Authorization: 'Bearer $' + '{HEXFRAME_TURN_KEY}' },
    },
  },
})
const [command, ...prefix] = turn.agent
const agent = spawn(command, [...prefix, ...turn.args, '--mcp-config', mcp, '--', turn.message], {
  stdio: ['ignore', 'pipe', 'ignore'],
})
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => agent.kill(signal))

let posted = Promise.resolve()
const post = (line) => {
  posted = posted.then(() =>
    fetch(turn.events, {
      method: 'POST',
      headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
      body: line,
    }).then(
      (response) => response.body?.cancel(),
      () => undefined,
    ),
  )
}
createInterface({ input: agent.stdout }).on('line', (line) => {
  if (line.trim() !== '') post(line)
})
let exited = false
const exit = (code, signal) => {
  if (exited) return
  exited = true
  post(JSON.stringify({ type: 'hexframe_exit', code, signal }))
  posted.then(() => process.exit(signal === 'SIGINT' ? 130 : (code ?? 1)))
}
agent.on('close', exit)
agent.on('error', () => exit(127, null))
`

/** What the code starting a Turn knows of it, beside the prompt. */
export interface Launch {
  readonly turnId: string
  /** The Turn's Key, its one secret: into the process's environment only. */
  readonly key: Redacted.Redacted
  /** The origin the sandbox reaches the app at. */
  readonly origin: string
  /** Where the app answers a Turn's sandbox there, by path: the MCP, the model proxy, the events. */
  readonly doors: { readonly mcp: string; readonly model: string; readonly events: string }
  /** The sandbox's home, every path of it from there. */
  readonly home: string
  /** The command line that runs the agent in this sandbox, before its arguments. */
  readonly agent: ReadonlyArray<string>
  /** The Tile's folder the Turn starts in, from the System folder, `''` for the Root's. */
  readonly folder: string
  /** The Message the Turn answers. */
  readonly message: string
  /** What the agent is told beside Claude Code's own prompt. */
  readonly prompt: string
}

/** A string in single quotes, for a shell. */
const quoted = (text: string) => `'${text.replaceAll("'", `'\\''`)}'`

/**
 * The files a Turn writes beside the System folder, from the sandbox's home, and the process it
 * starts: the launcher, in the Tile's folder, with the Turn's Key and the model's settings in its
 * environment, kept up for the Turn's maximum length.
 */
export function launchOf(launch: Launch): {
  readonly files: ReadonlyArray<SandboxFile>
  readonly run: Run
} {
  const folder = filesOf(launch.turnId)
  const prompt = `${launch.home}/${folder}/prompt.md`
  const turn = {
    agent: launch.agent,
    args: [
      '-p',
      '--output-format',
      'stream-json',
      '--verbose',
      '--model',
      settings.turn.model,
      '--append-system-prompt-file',
      prompt,
      '--strict-mcp-config',
      '--disallowedTools',
      ...withoutTools,
      '--permission-mode',
      'bypassPermissions',
      '--max-budget-usd',
      String(settings.turn.ceiling / 1_000_000),
      '--no-session-persistence',
    ],
    message: launch.message,
    mcp: `${launch.origin}${launch.doors.mcp}`,
    events: `${launch.origin}${launch.doors.events}`,
  }
  const key = Redacted.value(launch.key)
  return {
    files: [
      { path: `${folder}/prompt.md`, content: launch.prompt },
      { path: `${folder}/turn.json`, content: JSON.stringify(turn, null, 2) },
      { path: `${folder}/launcher.mjs`, content: launcher },
    ],
    run: {
      name: processOf(launch.turnId),
      command: `exec node ${quoted(`${launch.home}/${folder}/launcher.mjs`)}`,
      workingDir: launch.folder === '' ? systemFolder : `${systemFolder}/${launch.folder}`,
      env: {
        HEXFRAME_TURN_KEY: key,
        ANTHROPIC_AUTH_TOKEN: key,
        ANTHROPIC_BASE_URL: `${launch.origin}${launch.doors.model}`,
        ANTHROPIC_MODEL: settings.turn.model,
        ANTHROPIC_DEFAULT_HAIKU_MODEL: settings.turn.smallModel,
        ANTHROPIC_SMALL_FAST_MODEL: settings.turn.smallModel,
        CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: '1',
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
      },
      timeoutSeconds: settings.turn.longest / 1000,
    },
  }
}
