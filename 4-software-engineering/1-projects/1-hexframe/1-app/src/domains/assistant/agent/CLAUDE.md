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
| `prompt.ts` | `promptOf`, what the agent is told beside Claude Code's own prompt (`--append-system-prompt-file`): its files are a read-only snapshot of the System as the Turn started, every change goes through the MCP's tools naming the version it read, a Conflict means read the Tile again with `open_tile`, Help opens at `open_tile({ id: "help" })`; where it starts; the Tiles on the user's screen, by Title and Preview (`Glimpse`, the shape Assistant reads Mapping's by); and today's latest Entries, each as a line. Every ancestor's `CLAUDE.md` loads by itself from its working folder, so the System's own words are not repeated. No secret is ever in it |
| `launch.ts` | `launchOf`, the files a Turn writes beside the System folder, under `turns/<Turn>/`, its prompt, its settings (`turn.json`) and the launcher, and the process it starts (`processOf`, by the Turn's id): `exec node <launcher>`, in the Tile's folder, for `settings.turn.longest`, with the Turn's Key in its environment as `HEXFRAME_TURN_KEY` and `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL` at the proxy, the settings' models, and Claude Code's experimental betas and nonessential traffic off. The launcher runs the agent with `-p --output-format stream-json --verbose`, the settings' model, `--strict-mcp-config` and an MCP config it builds from the Key in its environment, `--disallowedTools` for Write, Edit, NotebookEdit, WebFetch and WebSearch (`withoutTools`), unattended permissions, `--max-budget-usd` at the Turn's ceiling, no session kept, and the Message last after `--`; hands a SIGINT on to it; posts each line it writes to the events door, in order, the Key its bearer, at the doors' paths the API layer gives (`Launch.doors`); then `hexframe_exit` once it exited |
| `stream.ts` | `readLine`, what Assistant keeps of one line of the stream (`AgentEvent`): `Said`, the text of an agent's message; `Stepping`, the last tool it runs, an MCP tool named without its server, with the first of its input's subjects (a command, a path, an id), cut short (`TurnStep`); `Finished`, its result, `success` by its answer, `error_max_budget_usd` by its ceiling, any other by its sandbox; `Exited`, the launcher's word that the agent exited. Every other event and field is left out; a line that is no JSON or names no type is none |
| `agent.test.ts` | Lines recorded as Claude Code writes them, read; the prompt, its rules, its location, the Tiles on screen and today's Entries; the launch, its files holding no secret, the Key in the environment alone, the arguments |

## Rules

- **The Turn's Key never reaches a file.** `launchOf` writes it into the process's environment and nowhere else; the launcher builds the MCP client's config from that environment in memory and hands it to the agent as an argument. `agent.test.ts` holds both.
- **The agent's words are read by a schema, and only what Assistant keeps.** A field Claude Code adds tomorrow is left out, a line it renames is none, and the door answers it 400.
- **The fake agent is the sandbox's, not Assistant's.** On this machine the sandbox runs it in Claude Code's place, behind the same arguments ([[4-software-engineering/1-projects/1-hexframe/1-app/src/repositories/agent/sandbox/CLAUDE|sandbox]]); nothing here knows which runs.
