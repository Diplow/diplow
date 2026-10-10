---
title: agent
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/repositories/agent
owner: diplo
preview: >-
  What the Assistant's agent runs on, one folder per seam: the sandbox, an
  Account's Blaxel machine holding its System as read-only files, where a Turn
  runs Claude Code, with a fake on this machine for the tests and dev; the
  model relay to Anthropic comes next.
---
# agent

What a Turn of the [[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/assistant/CLAUDE|Assistant]] runs on, its two seams with the outside world side by side, as STACK.md names them, so `repositories/` keeps one folder for both (`hexframe-app-assistant/decisions.md#DEC-10`).

| Folder | Holds |
|---|---|
| `sandbox/` | `@blaxel/core`, imported here only: an Account's sandbox, its System folder written whole and read-only, a Turn's files beside it, its processes started detached, followed and stopped by name; and the same on this machine, for every test and `pnpm dev` without `BL_API_KEY`: [[4-software-engineering/1-projects/1-hexframe/1-app/src/repositories/agent/sandbox/CLAUDE\|sandbox]] |

`anthropic/`, the model relay, plain `fetch` and no SDK, which only relays what Assistant has said a Turn may spend, comes with the proxy (HEX-82).
