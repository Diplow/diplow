---
title: proxy
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/api/server/proxy
owner: diplo
preview: >-
  /assistant/anthropic, the model proxy, one of the two doors of a Turn's
  sandbox: the base URL its Claude Code calls Anthropic through, opened by the
  Turn's Key alone, proven before the body is read. The messages endpoint and
  its count of tokens, POST only; each call handed to Assistant, which says
  whether the Turn may spend, and relayed as it comes; every refusal worded as
  Anthropic words one.
---
# proxy

The door a Turn's agent reaches the model through. Claude Code in the sandbox takes `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN`, sent as `Authorization: Bearer`: its base URL is this door, `<origin>/assistant/anthropic`, and its token the Turn's Key, so the platform's key never enters the sandbox. The door's rule, shared with the Turn's events, is in [[4-software-engineering/1-projects/1-hexframe/1-app/src/api/CLAUDE|api]] ("The sandbox's two doors"); the route, `front/routes/assistant/anthropic.$.ts`, hands the request over whole, its path after the base as the splat.

| File | Holds |
|---|---|
| `proxy.ts` | `serveModelCall(request, path)`: the Turn's Key proven from the header alone (`bearerOnly`, `provenKey`, IAM's `turnOnly`), a request no Turn proves answered 401 `authentication_error` before its body is read, one whose Key could not be checked 500 `api_error`; then a path but `/v1/messages` and `/v1/messages/count_tokens` 404 `not_found_error`; then the body read as text and handed, with `anthropic-version` and `anthropic-beta`, to `modelCall` (`../../assistant/programs.ts`); its answer as Anthropic words it: refused by the schema or the betas 400 `invalid_request_error`, past the largest call 413 `request_too_large`, held back by the Turn's ceiling or the month's allowance 402 `billing_error`, the Turn over 401, relayed with Anthropic's own status, headers and body as it comes. `methodNotAllowed`, 405 for anything but POST |
| `proxy.test.ts` | The door over PGlite, Better Auth for real, the fake Anthropic: no Key, a bad one, an expired one and an Account's Key refused with the body unread; a stream relayed chunk by chunk, the version and betas passed, the platform's key in place of the Turn's; `max_tokens` capped, the count of tokens served; another endpoint, an unnamed model, field, server tool or beta, and a body no JSON refused, nothing called; each call's cost recorded on its Turn once its answer ended; a Turn ended by its ceiling, the call before let through just below, its Key revoked; a Turn held back by the month's allowance |

## Connect a Claude Code

What the code running a Turn (HEX-83) puts in the sandbox's processes' environment, the Turn's Key the one secret among them:

```sh
ANTHROPIC_BASE_URL=<origin>/assistant/anthropic
ANTHROPIC_AUTH_TOKEN=<the Turn's Key>
ANTHROPIC_MODEL=claude-sonnet-5-5
ANTHROPIC_DEFAULT_HAIKU_MODEL=claude-haiku-4-5
CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1
CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
```

Without `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS`, Claude Code names betas and a `safeguards` field the settings don't, and every call is refused (`hexframe-app-assistant/decisions.md#DEC-12`).

## Rules

- **The Turn's Key, before anything else.** Nothing of the request is read before its Key proved a running Turn: not its path, not its body. An Account's Key, which opens `/mcp`, proves nothing here.
- **The Account and the Turn come from the Key**, never from the call: the body is Anthropic's, and nothing in it names who pays.
- **Assistant decides, the repository relays.** The door neither caps nor counts: Assistant lets the call through by its settings, says whether the Turn may spend, ends it by the limit it reached, and records what each call cost once its answer has ended, through the platform's `waitUntil`.
- **A refusal is Anthropic's shape**, `{ type: 'error', error: { type, message } }` with the status Anthropic gives that type, so Claude Code reads it and stops rather than retrying: a 402 for a limit, never a 429 or a 5xx it would retry.
