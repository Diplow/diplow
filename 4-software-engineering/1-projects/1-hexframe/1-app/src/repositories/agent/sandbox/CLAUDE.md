---
title: sandbox
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/repositories/agent/sandbox
owner: diplo
preview: >-
  The sandbox repository, the one folder that imports @blaxel/core: each
  Account's sandbox ensured by a name its id never shows in, on standby between
  Turns, deleted after a week idle, reaching the app's hosts alone; its System
  folder written whole and read-only; a Turn's files beside it; its processes
  started detached, followed, interrupted then killed. And a fake on this
  machine, for every test and pnpm dev without BL_API_KEY.
---
# sandbox

Where a Turn runs: one sandbox per Account, the `Sandbox` service's `ensure` answering it as a `Box`, whose paths are all from its `home`. It speaks paths, text and commands; what a Turn writes and runs, and which files the System is, belong to [[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/assistant/CLAUDE|Assistant]] and [[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/mapping/CLAUDE|Mapping]]. Only this folder imports `@blaxel/core` (`dependency-cruiser.config.ts`, `sdks`; `scripts/lint.test.ts` proves the rule fires).

| File | Holds |
|---|---|
| `sandbox.ts` | The service both layers provide: `Sandbox`, `ensure`, and `Box`: `replaceSystem`, the System folder (`system/`) written whole, whatever it held gone, then read-only; `write`, a file beside it; `start`, a process (`Run`: its name, command line, folder, environment and time), detached; `stop`, SIGINT then, past a grace, a kill; `status` (`RunStatus`). `sandboxName`, an Account's sandbox named by a hash of its id and the deployment's namespace; `inside` and `outsideTheSystem`, the paths it takes, a defect otherwise |
| `blaxel.ts` | `layer`, over Blaxel, and `deployment`, the namespace and hosts it reads from Vercel: `createIfNotExists` from `blaxel/claude-code:latest`, deleted after 7 days idle (`ttl-idle`), its egress through Blaxel's proxy to the deployment's hosts alone, the firewall's `proxy` ruleset holding every process to it; its home `/blaxel/hexframe`; the System folder wiped, written in one `writeTree` and set `a-w` by commands it runs to their end; a process run with `keepAlive` for its time; a stop's SIGINT sent by `kill -INT` from inside, Blaxel's own stop sending none, then Blaxel's kill after 10 s |
| `local.ts` | The fake: `makeLocal`, every Account's sandbox a folder under a root, the System folder read-only by its modes, each process a child of this one in its own process group, so a stop's SIGINT and a kill reach what its shell started; `layer`, under the system's temporary folder, which `pnpm dev` uses |
| `blaxel.test.ts` | The Blaxel layer, never calling Blaxel: a preview's sandboxes named in its branch's host, production's in its domain, `local` off Vercel, each reaching its deployment's hosts alone; the layer built without credentials, ensuring then a defect naming them |
| `sandbox.test.ts` | On the fake, real processes and real time: one sandbox per Account, named without its id; the System folder written, rewritten with nothing of the one before left, refusing a write from this process and from one the sandbox runs; a file beside it, never inside it nor out of the home; a process in its folder with its environment, completed or failed by its code, interrupted cleanly, killed past its grace or its time |

## Rules

- **No test and no gate reaches Blaxel.** `src/api/server/run.ts` takes the fake under `pnpm dev` without `BL_API_KEY` and in every test, where `vitest.config.ts` empties it whatever the shell exports; a build never holds that branch. The Blaxel layer builds without its credentials, so the rest of the app runs, and ensuring a sandbox is then a defect.
- **One secret enters a sandbox: the Turn's Key**, in a process's `env`, never in a file `write` or `replaceSystem` puts there (STACK.md, "Turn"). The layer adds none of its own: Blaxel's credentials stay in the app's process.
- **The System folder is written whole, never one file.** `write` refuses any path inside it, and its modes refuse a write from any user but root; a Turn keeps its agent off it by its tools too (`hexframe-app-assistant/decisions.md#DEC-10`).
- **A stop interrupts before it kills**, so Claude Code ends its turn cleanly: the signal reaches the process the command line became, so a script ends in `exec`.
- **A failure below is a defect.** Blaxel unreachable, a command that should not fail failing: the caller sees no typed error, as the database's callers see none.

## Environment

| Variable | Where | What |
|---|---|---|
| `BL_WORKSPACE`, `BL_API_KEY` | every deployed environment that runs Turns; locally in `.env.local`, never committed, to try Blaxel by hand | The Blaxel workspace and its key. Without `BL_API_KEY`, `pnpm dev` runs on the fake |
| `VERCEL`, `VERCEL_ENV`, `VERCEL_URL`, `VERCEL_BRANCH_URL`, `VERCEL_PROJECT_PRODUCTION_URL` | set by Vercel at runtime | The hosts a sandbox may reach, and the namespace its name is hashed in: production's domain, else the branch's URL, else the deployment's. Off Vercel, `localhost` and `local` |
