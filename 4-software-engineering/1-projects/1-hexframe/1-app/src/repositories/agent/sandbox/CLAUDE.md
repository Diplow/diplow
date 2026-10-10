---
title: sandbox
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/repositories/agent/sandbox
owner: diplo
preview: >-
  The sandbox repository, the one folder that imports @blaxel/core: each
  Account's sandbox ensured by a name its id never shows in, on standby between
  Turns, deleted after a week idle, reaching the app's hosts alone; its System
  folder written whole and read-only; a Turn's files beside it; its processes
  started detached, followed, interrupted then killed; the agent's command and
  the origin a sandbox reaches the app at. And a fake on this machine, running
  a fake agent in Claude Code's place, for every test and pnpm dev without
  BL_API_KEY.
---
# sandbox

Where a Turn runs: one sandbox per Account, the `Sandbox` service's `ensure` answering it as a `Box`, whose paths are all from its `home`. It speaks paths, text and commands; what a Turn writes and runs, and which files the System is, belong to [[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/assistant/CLAUDE|Assistant]] and [[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/mapping/CLAUDE|Mapping]]. Only this folder imports `@blaxel/core` (`dependency-cruiser.config.ts`, `sdks`; `scripts/lint.test.ts` proves the rule fires).

| File | Holds |
|---|---|
| `sandbox.ts` | The service both layers provide: `Sandbox`, `ensure`, `agent`, the command line that runs Claude Code in a sandbox before its arguments, and `origin`, where a sandbox reaches the app given where a request reached it; and `Box`: `replaceSystem`, the System folder (`systemFolder`) written whole, whatever it held gone, then read-only; `write`, a file beside it; `start`, a process (`Run`), detached, its HOME a folder of its own in the work folder (`workFolder`, `homeOf`), everything else the work folder held removed first; `stop`, SIGINT then, past a grace, a kill, nothing for a process not running; `status` (`RunStatus`). `ended`, the one rule both layers read a process's state by: how it ended, never who ended it. `sandboxName`, an Account's sandbox named by a hash of its id and the deployment's namespace; `inside` and `outsideTheSystem`, the paths it takes, a defect otherwise |
| `blaxel.ts` | `layer`, over Blaxel, which always builds; `hasCredentials`, which `run.ts` decides by too; `deployment`, the namespace and hosts it reads from Vercel, and `canonical`, the host its sandboxes reach the app at, production's domain, else the branch's URL, which must answer without Vercel's protection. Its agent is `claude`, on the image's PATH. A sandbox made from `image` by `createIfNotExists`, deleted after `idleLifetime` idle, its egress through Blaxel's proxy to the deployment's hosts alone, the firewall's `proxy` ruleset holding every process to it (`networkDrifted`, when to set it again); its `home` root's, the work folder its `user`'s, `hexframe`; the System folder wiped, written in one `writeTree`, given to root and set read-only by commands it runs to their end; a process run as that user through `setpriv`, with `keepAlive` for its time; a stop's SIGINT sent by `kill -INT` from inside, Blaxel's own stop sending none, then Blaxel's kill past `grace`; `statusFrom`, Blaxel's report read by `ended` |
| `local.ts` | The fake: `makeLocal`, every Account's sandbox a folder under a root, reaching the app where the request reached it, its agent the fake one written beside the boxes, at its pace, or Claude Code itself (`agentOf`, from `HEXFRAME_AGENT` and `HEXFRAME_FAKE_AGENT_PACE`), two ensures at once sharing one, the System folder read-only by its modes, each process a child of this one, run as this process's user, in its own process group: a stop's SIGINT goes to the process alone, as Blaxel's does, so a command line that does not end in `exec` fails here too, and a kill to the whole group; `layer`, under the system's temporary folder, which `pnpm dev` uses |
| `fake-agent.ts` | `fakeAgent`, the fake agent's script: a Node program taking Claude Code's arguments, which replays a `stream-json` stream, says which folder of the System it works in, opens the Tile that folder holds and writes one under it through the MCP its `--mcp-config` names, for real, then answers; it waits its pace before each tool, a minute before answering a Message asking it to go slowly, and ends on a SIGINT. It calls no model |
| `blaxel.test.ts` | The Blaxel layer, never calling Blaxel: a preview's sandboxes named in its branch's host, production's in its domain, `local` off Vercel, each reaching its deployment's hosts alone; a network set again unless it allows exactly those hosts through the proxy's ruleset; Blaxel's states read by `ended`; the layer built without credentials, empty ones included, or with a setup that failed, ensuring then a defect saying why |
| `sandbox.test.ts` | On the fake, real processes and real time: one sandbox per Account, named without its id, one for two ensures at once; the System folder written, rewritten with nothing of the one before left, refusing a write from this process and from one the sandbox runs; a file beside it, never inside it nor out of the home; a process in its folder with its environment, completed or failed by its code, stopped by a SIGINT however sent, interrupted cleanly, killed past its grace or its time |

## Rules

- **No test and no gate reaches Blaxel.** `src/api/server/run.ts` takes the fake under `pnpm dev` without both credentials (`hasCredentials`) and in every test, where `vitest.config.ts` empties them whatever the shell exports; a build never holds that branch. The Blaxel layer always builds, so the rest of the app runs, and ensuring a sandbox is then a defect.
- **One secret enters a sandbox: the Turn's Key**, in a process's `env`, never in a file `write` or `replaceSystem` puts there (STACK.md, "Turn"). The layer adds none of its own: Blaxel's credentials stay in the app's process, and Vercel's bypass for automation never enters one, so a sandbox reaches a deployment whose protection is off, production, or a preview opened by hand.
- **A sandbox reaches the app at the deployment's own host**, `origin`: the one its network lets through, never the host a request happened to reach. On this machine, the fake reaches `localhost` where the request came from.
- **The System folder is written whole, never one file.** `write` refuses any path inside it. On Blaxel it is root's and read-only, and a process runs as a user of its own, `hexframe`, who can write its work folder and nothing else of the home; the fake keeps it read-only by its modes for this process's user (`hexframe-app-assistant/decisions.md#DEC-10`).
- **No process leaves anything to the next.** Each starts with a HOME of its own in the work folder, the rest of it removed, so a setting or a hook an agent wrote there never reaches the next Turn's.
- **A stop interrupts before it kills**, so Claude Code ends its turn cleanly: the signal reaches the process the command line became, so a script ends in `exec`.
- **A failure below is a defect.** Blaxel unreachable, a command that should not fail failing: the caller sees no typed error, as the database's callers see none.

## Environment

| Variable | Where | What |
|---|---|---|
| `BL_WORKSPACE`, `BL_API_KEY` | every deployed environment that runs Turns; locally in `.env.local`, never committed, to try Blaxel by hand | The Blaxel workspace and its key. Without both, `pnpm dev` runs on the fake |
| `VERCEL`, `VERCEL_ENV`, `VERCEL_URL`, `VERCEL_BRANCH_URL`, `VERCEL_PROJECT_PRODUCTION_URL` | set by Vercel at runtime | The hosts a sandbox may reach, and the namespace its name is hashed in and the host it reaches the app at: production's domain, else the branch's URL, else the deployment's. Off Vercel, `localhost` and `local` |
| `HEXFRAME_AGENT`, `HEXFRAME_FAKE_AGENT_PACE` | locally, in the shell, never committed | On the fake, `claude` runs Claude Code itself in the fake agent's place, through the app's proxy, which answers from the fake Anthropic without `ANTHROPIC_API_KEY`; the fake agent's pace in milliseconds, 2 s by default, none in tests (`vitest.config.ts`) |
