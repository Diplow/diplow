---
title: keys
parent: 4-software-engineering/1-projects/1-hexframe/1-app/src/front/features/keys
owner: diplo
preview: >-
  The Keys page's content: name and issue a Key, see its secret once beside
  the command that adds hexframe to Claude Code, list the Account's Keys and
  revoke one after a confirmation. Its actions move into the chat once the
  Assistant exists.
---
# keys

What `/settings/keys` shows, behind `signedInOnly`. A Key is IAM's: a credential the Account issues to a program, such as Claude Code, which proves the Account at `/mcp` ([[4-software-engineering/1-projects/1-hexframe/1-app/src/domains/iam/CLAUDE|iam]]). The calls go through `front/client/iam/keys.ts` ([[4-software-engineering/1-projects/1-hexframe/1-app/src/front/CLAUDE|front]]).

- **Issue**: a name, then the Key's secret and the `claude mcp add` command that holds it, each with a copy button. The command names the hexframe the page was served from, its origin read in the browser when the answer arrives.
- **List**: the Keys on `DataTable`, by name, first characters, creation and last use; `EmptyState` when there is none.
- **Revoke**: from a Key's row, once `ConfirmDialog` is confirmed.

| File | Holds |
|---|---|
| `Keys.tsx` | `Keys`, the page's content: the issue form or the Key just issued, then the list, inside its `ReadBoundary` |
| `command.ts` | `mcpCommand`, the command that adds hexframe's MCP server to Claude Code with a Key. Pure and tested |

## Rules

- **The secret is shown once and kept nowhere.** It reaches the page in issuing's answer only, through a form's submit, which no cache holds; it lives in `Keys`'s state, so leaving the screen, or Done, forgets it.
- **A refusal takes its channel**: a name IAM refuses (`KeyNameInvalid`) shows under the field; a revoke of a Key already gone (`KeyNotFound`) in a toast.
- **These actions move into the chat once the Assistant exists.** The page is where they live until then.
