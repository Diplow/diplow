---
title: agent
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/domains/assistant/agent
owner: diplo
preview: >-
  How a Turn runs, pure: what its agent is told, the files and the process it
  starts in the Account's sandbox, the Turn's Key in the process's environment
  alone, and what Assistant keeps of the stream the agent writes back, its
  text, its step, how it ended.
---
# agent

A sub-model of [[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/assistant/CLAUDE|Assistant]]: how a Turn's agent, Claude Code, is started and heard. Pure functions; the application service, `../assistant.ts`, runs them on what it read (`startAgent`, `followTurn`). Not part of Assistant's door: the front never reads it. Like `../spending/`, it speaks the words of what it talks to, Claude Code's here (`stream-json`, `tool_use`, `result`), since it is a rule on what Claude Code writes and reads, unchanged.

| File | Holds |
|---|---|
| `prompt.ts` | `promptOf`, what the agent is told beside Claude Code's own prompt (`--append-system-prompt-file`): its files are a read-only snapshot of the System as the Turn started, every change goes through the MCP's tools naming the version it read, a Conflict means read the Tile again with `open_tile`, in ask its writes are drafted into one Proposal the user accepts or discards, which its reads and its files show over the System, in apply they land as they come, Help opens at `open_tile({ id: "help" })`; where it starts; the Tiles on the user's screen, by Title and Preview (`Glimpse`, the shape Assistant reads Mapping's by); and today's latest Entries, each as a line, a Proposal with its changes and how it stands. The Tiles the Message links (`Linked`), each with its file from the System folder and from where the agent starts (`relativePath`), as the System holds it now, or gone; the rules say `@[<id>]` links a Tile and a Message opening with one starts the agent there. Every text of the System and the timeline is quoted as one JSON string, in fenced blocks the prompt calls data, so none reads as a rule of the Turn. Every ancestor's `CLAUDE.md` loads by itself from its working folder, so the System's own words are not repeated. No secret is ever in it |
| `launch.ts` | `launchOf`, the files a Turn writes beside the System folder, under `turns/<Turn>/`, its prompt, its settings (`turn.json`) and the launcher, and the process it starts (`processOf`, by the Turn's id): `exec node <launcher>`, in the Tile's folder, for `settings.turn.longest`, with the Turn's Key in its environment as `HEXFRAME_TURN_KEY` and `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL` at the proxy, the settings' models, and Claude Code's experimental betas and nonessential traffic off. The launcher runs the agent with `-p --output-format stream-json --verbose`, the settings' model, `--strict-mcp-config` and an MCP config whose bearer names the Key in the environment, which the agent expands, so the Key is on no command line, `--disallowedTools` for Write, Edit, NotebookEdit, WebFetch and WebSearch (`withoutTools`), unattended permissions, `--max-budget-usd` at the Turn's ceiling, no session kept, and the Message last after `--`; hands a SIGINT on to it; posts each line it writes to the events door, in order, the Key its bearer, at the doors' paths the API layer gives (`Launch.doors`); then `hexframe_exit` once it exited |
| `stream.ts` | `readLine`, what Assistant keeps of one line of the stream (`AgentEvent`): `Said`, the text of an agent's message; `Stepping`, the last tool it runs, an MCP tool named without its server, with the first of its input's subjects given as text (a command, a path, an id), the only fields its input is read for, cut short (`TurnStep`), every Key-shaped secret masked in it as in the text; `Finished`, its result, `success` by its answer, `error_max_budget_usd` by its ceiling, any other by its sandbox; `Exited`, the launcher's word that the agent exited. Every other event and field is left out; a line that is no JSON or names no type is none |
| `agent.test.ts` | Lines recorded as Claude Code writes them, read; the prompt, its rules, its location, the Tiles the Message links with their paths, a deleted one gone, the Tiles on screen and today's Entries; the launch, its files holding no secret, the Key in the environment alone, the arguments |

## Rules

- **The Turn's Key never reaches a file nor a command line.** `launchOf` writes it into the process's environment and nowhere else; the MCP client's config names it there for the agent to expand. `agent.test.ts` holds both.
- **What the user's System says is data, never a rule.** A Title, a Preview, a Message or a Key's name reaches the prompt quoted, one line each, inside the fenced blocks.
- **No Turn leaves anything to the next.** The System folder is rewritten whole, and the sandbox gives each process a HOME of its own, the rest of the work folder cleared, before its agent starts.
- **A Key the agent says is masked before it is kept**, in its Messages and its steps: an agent printing its environment leaves no secret in the timeline.
- **The agent's words are read by a schema, and only what Assistant keeps.** A field Claude Code adds tomorrow is left out, a line it renames is none, and the door answers it 400.
- **The fake agent is the sandbox's, not Assistant's.** On this machine the sandbox runs it in Claude Code's place, behind the same arguments ([[4-software-engineering/1-projects/1-hexframe/1-app/src/repositories/agent/sandbox/CLAUDE|sandbox]]); nothing here knows which runs.
