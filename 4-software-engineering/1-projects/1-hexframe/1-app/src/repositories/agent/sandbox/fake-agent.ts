// The fake agent the sandbox on this machine runs in Claude Code's place (./local.ts): a Node script,
// taking Claude Code's arguments, that replays a scripted `stream-json` stream, each event a line on its
// standard output, as `claude -p --output-format stream-json --verbose` writes them. It opens the Tile
// its working folder holds through the MCP its `--mcp-config` names, with the bearer given there, the
// Message it answers its last argument, after `--`, as the Turn's launcher passes it, and
// writes a Tile under it through the same MCP, for real, and answers. It waits `--pace` milliseconds
// before each tool, so a page polling every 2 s sees its steps, and a minute before answering a
// Message that asks it to go slowly, so a Stop has something to stop. It spends nothing: it calls no
// model. A SIGINT ends it as it ends Claude Code, with no answer.

/** The script, as the sandbox writes it beside its boxes. */
export const fakeAgent = String.raw`
import { readFileSync } from 'node:fs'

const args = process.argv.slice(2)
const option = (name) => {
  const at = args.indexOf(name)
  return at === -1 ? undefined : args[at + 1]
}
const pace = Number(option('--pace') ?? '2000')
const message = args.includes('--') ? args.slice(args.indexOf('--') + 1).join(' ') : ''
const config = JSON.parse(option('--mcp-config') ?? '{"mcpServers":{}}')
const server = Object.values(config.mcpServers)[0]

const say = (event) => process.stdout.write(JSON.stringify(event) + '\n')
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const assistant = (content) => say({ type: 'assistant', message: { role: 'assistant', content } })

process.on('SIGINT', () => process.exit(130))

let calls = 0
async function tool(name, input) {
  calls += 1
  const id = 'toolu_fake_' + String(calls)
  assistant([{ type: 'tool_use', id, name: 'mcp__hexframe__' + name, input }])
  await wait(pace)
  const response = await fetch(server.url, {
    method: 'POST',
    headers: {
      ...server.headers,
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: calls,
      method: 'tools/call',
      params: { name, arguments: input },
    }),
  })
  const answer = await response.json()
  const text = answer.result?.content?.[0]?.text ?? JSON.stringify(answer.error ?? null)
  say({
    type: 'user',
    message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: text }] },
  })
  return answer.result?.isError === false || answer.result?.isError === undefined
    ? JSON.parse(text)
    : undefined
}

say({ type: 'system', subtype: 'init', session_id: 'fake', tools: [], mcp_servers: [] })
const here = /^id: (.+)$/m.exec(readFileSync('CLAUDE.md', 'utf8'))?.[1]?.trim()
assistant([{ type: 'text', text: 'Let me look at where you are.' }])
const opened = here === undefined ? undefined : await tool('open_tile', { id: here })
if (/slowly/i.test(message)) await wait(60_000)
const taken = (slot) => slot in (opened?.branches ?? {}) || slot in (opened?.leaves ?? {})
const slot = [1, 2, 3, 4, 5, 6].find((direction) => !taken(String(direction)))
const title = 'Drafted by the Assistant'
const created =
  opened === undefined || slot === undefined
    ? undefined
    : await tool('create_tile', {
        parent: opened.tile.id,
        slot,
        title,
        preview: 'A Tile the fake agent wrote, to show a write landing.',
        body: '',
      })
const answer =
  created === undefined
    ? 'I looked around, and found no free slot to write in.'
    : 'I added "' + title + '" under ' + (opened.tile.title || 'this Tile') + '.'
assistant([{ type: 'text', text: answer }])
say({ type: 'result', subtype: 'success', is_error: false, result: answer, total_cost_usd: 0 })
`
